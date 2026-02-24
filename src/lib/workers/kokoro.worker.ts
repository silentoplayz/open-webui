import { env, RawAudio } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';

// TODO: Below doesn't work as expected, need to investigate further
env.backends.onnx.wasm.wasmPaths = '/wasm/';

let tts: InstanceType<typeof KokoroTTS> | null = null;
let isInitialized = false; // Flag to track initialization status
const DEFAULT_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'; // Default model

// Returns true only when a real WebGPU adapter can be obtained.
// navigator.gpu exists in some browsers (e.g. Firefox with partial WebGPU support)
// but requestAdapter() may return null, causing Kokoro.js to throw silently.
const isWebGPUAvailable = async (): Promise<boolean> => {
	try {
		if (!(navigator as any)?.gpu) return false;
		const adapter = await (navigator as any).gpu.requestAdapter();
		return adapter !== null;
	} catch {
		return false;
	}
};

// Generate audio, supporting '+'-joined voice blending (e.g. "af_alloy+af_heart+af_sky").
//
// Single voice: delegates to tts.generate() directly (no change in behaviour or perf).
//
// Voice blend: runs one tts.generate() pass per named voice (sequentially, since ONNX
// Runtime does not support concurrent inference sessions in the same worker), then
// element-wise averages the resulting PCM waveforms into a blended RawAudio object.
const generateAudio = async (text: string, voiceId: string): Promise<RawAudio> => {
	const parts = voiceId
		.split('+')
		.map((v) => v.trim())
		.filter(Boolean);

	// ── Single voice fast path ──────────────────────────────────────────────
	if (parts.length <= 1) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return tts!.generate(text, { voice: voiceId as any });
	}

	// ── Multi-voice blend path ──────────────────────────────────────────────
	// Validate all voice names upfront using the list exposed by kokoro-js
	const validNames = Object.keys(tts!.voices);
	const invalid = parts.filter((v) => !validNames.includes(v));
	if (invalid.length > 0) {
		throw new Error(
			`Voice blend failed — unknown voice(s): ${invalid.join(', ')}. ` +
				`Available: ${validNames.join(', ')}.`
		);
	}

	// Generate audio for each voice sequentially — ONNX Runtime does not support
	// concurrent inference sessions within the same Worker ("Session already started").
	const results: RawAudio[] = [];
	for (const v of parts) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		results.push(await tts!.generate(text, { voice: v as any }));
	}

	// Extract raw PCM from each RawAudio result.
	// RawAudio (from @huggingface/transformers) stores waveform data at `.audio`
	// and sample rate at `.sampling_rate`.
	const waveforms: Float32Array[] = results.map((r) => r.audio);
	const sampleRate: number = results[0].sampling_rate;

	// Average the waveforms element-wise.
	// Pad shorter waveforms with silence so all outputs can be mixed evenly.
	const maxLen = Math.max(...waveforms.map((w) => w.length));
	const blended = new Float32Array(maxLen);
	const weight = 1 / waveforms.length;

	for (const waveform of waveforms) {
		for (let i = 0; i < maxLen; i++) {
			blended[i] += (waveform[i] ?? 0) * weight;
		}
	}

	// Wrap in a RawAudio so that .toBlob() works identically to the single-voice path.
	return new RawAudio(blended, sampleRate);
};

self.onmessage = async (event) => {
	const { type, payload } = event.data;

	if (type === 'init') {
		const { dtype } = payload;
		const model_id: string = payload.model_id || DEFAULT_MODEL_ID; // Use default model if none provided

		self.postMessage({ status: 'init:start' });

		try {
			const webGPU = await isWebGPUAvailable();
			tts = await KokoroTTS.from_pretrained(model_id, {
				dtype,
				device: webGPU ? 'webgpu' : 'wasm'
			});
			isInitialized = true; // Mark as initialized after successful loading
			self.postMessage({ status: 'init:complete' });
		} catch (error) {
			isInitialized = false; // Ensure it's marked as false on failure
			self.postMessage({
				status: 'init:error',
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	if (type === 'generate') {
		if (!isInitialized || !tts) {
			// Ensure model is initialized
			self.postMessage({ status: 'generate:error', error: 'TTS model not initialized' });
			return;
		}

		const { text, voice } = payload;
		self.postMessage({ status: 'generate:start' });

		try {
			const result = await generateAudio(text, voice);
			const blob = await result.toBlob();
			const blobUrl = URL.createObjectURL(blob);
			self.postMessage({ status: 'generate:complete', audioUrl: blobUrl });
		} catch (error) {
			self.postMessage({
				status: 'generate:error',
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	if (type === 'status') {
		// Respond with the current initialization status
		self.postMessage({ status: 'status:check', initialized: isInitialized });
	}
};
