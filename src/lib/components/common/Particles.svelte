<script context="module" lang="ts">
	import { loadAll } from '@tsparticles/all';
	let initPromise: Promise<void> | undefined;

	/**
	 * Ensures the tsParticles engine is initialized only once per session.
	 * Redundant initialization can lead to internal state corruption and rendering failures.
	 */
	export const initParticlesSync = async () => {
		if (initPromise) return initPromise;

		// Create the promise once and store it
		initPromise = (async () => {
			const { particlesInit } = await import('@tsparticles/svelte');
			await particlesInit(async (engine) => {
				await loadAll(engine);
			});
		})();

		return initPromise;
	};
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Container } from '@tsparticles/engine';
	import { v4 as uuidv4 } from 'uuid';

	export let options: any;
	export let url: string | undefined = undefined;

	// Use a unique ID for each instance to prevent DOM conflicts during rapid re-mounting.
	// This ensures the engine attaches to exactly the right element in the DOM.
	const instanceId = `tsparticles-${uuidv4()}`;
	let particlesContainer: Container | undefined;
	let ParticlesComponent: any;
	let currentOptions = JSON.stringify(options);

	onMount(async () => {
		// Wait for the singleton initialization to complete
		await initParticlesSync();

		// Only load the component once the engine is ready
		const { default: Particles } = await import('@tsparticles/svelte');
		ParticlesComponent = Particles;
	});

	onDestroy(() => {
		if (particlesContainer) {
			console.log(`[Particles] Destroying container: ${instanceId}`);
			particlesContainer.destroy();
			particlesContainer = undefined;
		}
	});

	const onParticlesLoaded = (event: CustomEvent<{ particles: Container }>) => {
		particlesContainer = event.detail.particles;
	};

	// Use a stringified version of the options to trigger the {#key} block.
	// This ensures that the particles engine re-initializes whenever the configuration changes.
	$: currentOptions = JSON.stringify(options);

	const sanitizeOptions = (opts: any) => {
		if (!opts) return opts;
		const newOpts = JSON.parse(JSON.stringify(opts));

		// Fix CanvasMask filter error: tsparticles expects a function for pixels.filter
		// but JSON themes provide it as a string or empty object.
		if (newOpts.canvasMask?.pixels && typeof newOpts.canvasMask.pixels.filter !== 'function') {
			delete newOpts.canvasMask.pixels.filter;
		}

		return newOpts;
	};

	$: sanitizedOptions = sanitizeOptions(options);
</script>

{#if ParticlesComponent}
	{#key currentOptions}
		<svelte:component
			this={ParticlesComponent}
			id={instanceId}
			class="pointer-events-none absolute top-0 left-0 w-full h-full"
			style="z-index: 4;"
			options={sanitizedOptions}
			{url}
			on:particlesLoaded={onParticlesLoaded}
		/>
	{/key}
{/if}
