import { WEBUI_BASE_URL } from '$lib/constants';

/**
 * Shared type for gallery image files returned by the backend file API.
 */
export interface GalleryImageFile {
	id: string;
	filename: string;
	meta: {
		name?: string;
		content_type?: string;
		size?: number;
		data?: Record<string, unknown>;
	};
	created_at: number;
}

/** Size preset offered by the editor's aspect-ratio control. */
export interface SizePreset {
	label: string;
	value: string;
	ratio?: string;
	icon: string;
}

/** Common size presets for image dimensions. */
export const IMAGE_SIZE_PRESETS: SizePreset[] = [
	{ label: '1:1', value: '1024x1024', ratio: '1:1', icon: 'square' },
	{ label: '16:9', value: '1792x1024', ratio: '16:9', icon: 'landscape' },
	{ label: '9:16', value: '1024x1792', ratio: '9:16', icon: 'portrait' },
	{ label: '4:3', value: '1024x768', ratio: '4:3', icon: 'landscape-sm' },
	{ label: '3:4', value: '768x1024', ratio: '3:4', icon: 'portrait-sm' }
];

/**
 * Resolve an image URL returned by the backend.
 * Relative paths (e.g. `/api/v1/files/{id}/content`) are prefixed with
 * WEBUI_BASE_URL so the browser fetches from the correct origin (critical
 * in dev mode where frontend and backend run on different ports).
 */
export const resolveFileUrl = (url: string): string => {
	if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
		return url;
	}
	return `${WEBUI_BASE_URL}${url}`;
};

/**
 * Read a File object as a base64 data URL.
 * Replaces the repeated FileReader boilerplate found throughout the codebase.
 */
export const readFileAsDataUrl = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
};

/**
 * Fetch an image from the backend as a blob.
 * The status check matters: a failed response still has a body, so without it
 * an error payload (e.g. a JSON 401) would be treated as image data.
 */
const fetchImageBlob = async (url: string, token: string): Promise<Blob> => {
	const response = await fetch(resolveFileUrl(url), {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.status}`);
	}
	return await response.blob();
};

/**
 * Copy an image to the clipboard as a PNG.
 * Fetches the image with auth headers, converts to PNG if needed,
 * and writes to the clipboard via the Clipboard API.
 */
export const copyImageToClipboard = async (url: string, token: string): Promise<void> => {
	const blob = await fetchImageBlob(url, token);

	const pngBlob =
		blob.type === 'image/png'
			? blob
			: await new Promise<Blob>((resolve, reject) => {
					const objectUrl = URL.createObjectURL(blob);
					const img = new Image();
					img.onload = () => {
						const canvas = document.createElement('canvas');
						canvas.width = img.naturalWidth;
						canvas.height = img.naturalHeight;
						canvas.getContext('2d')?.drawImage(img, 0, 0);
						canvas.toBlob((b) => {
							URL.revokeObjectURL(objectUrl);
							resolve(b || blob);
						}, 'image/png');
					};
					img.onerror = () => {
						// Without this the promise would never settle and the caller
						// would hang waiting on an image that cannot be decoded.
						URL.revokeObjectURL(objectUrl);
						reject(new Error('Failed to decode image for clipboard'));
					};
					img.src = objectUrl;
				});

	await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
};

/**
 * Download an image file with proper auth.
 * Fetches the image as a blob and triggers a browser download.
 */
export const downloadImage = async (
	url: string,
	filename: string,
	token: string
): Promise<void> => {
	const blob = await fetchImageBlob(url, token);
	const blobUrl = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = blobUrl;
	a.download = filename || 'generated-image.png';
	a.click();
	// Revoking synchronously can cancel the download before the browser has
	// read the blob, so let the click settle first.
	setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
};

/** Extract model name from file metadata (handles different backend engines). */
export const getFileModel = (data: Record<string, unknown> | undefined): string | null => {
	if (!data) return null;
	// Direct model field (OpenAI, Gemini, ComfyUI)
	if (data.model) return data.model as string;
	// A1111 info string: "Steps: 20, ..., Model: xyz, ..."
	const info = data.info as string | undefined;
	if (info) {
		const match = info.match(/Model:\s*([^,\n]+)/i);
		if (match) return match[1].trim();
	}
	return null;
};

/** Extract generation size from file metadata (handles different backend engines). */
export const getFileSize = (data: Record<string, unknown> | undefined): string | null => {
	if (!data) return null;
	// Direct size field (OpenAI, Gemini, ComfyUI)
	if (typeof data.size === 'string') return data.size;
	// A1111 stores width/height separately
	if (data.width && data.height) return `${data.width}x${data.height}`;
	return null;
};
