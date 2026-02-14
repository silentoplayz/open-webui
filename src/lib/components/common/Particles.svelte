<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Container } from '@tsparticles/engine';
	import { loadAll } from '@tsparticles/all';

	export let options: any;
	export let url: string | undefined = undefined;

	let particlesContainer: Container | undefined;
	let ParticlesComponent;
	let currentOptions = JSON.stringify(options);

	onMount(async () => {
		const { default: Particles } = await import('@tsparticles/svelte');
		const { particlesInit } = await import('@tsparticles/svelte');

		await particlesInit(async (engine) => {
			await loadAll(engine);
		});

		ParticlesComponent = Particles;
	});

	onDestroy(() => {
		if (particlesContainer) {
			particlesContainer.destroy();
			particlesContainer = undefined;
		}
	});

	const onParticlesLoaded = (event) => {
		particlesContainer = event.detail.particles;
	};

	// Prevent unnecessary re-renders if options are structurally identical
	$: if (options && JSON.stringify(options) !== currentOptions) {
		currentOptions = JSON.stringify(options);
	}

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
			id="tsparticles"
			class="pointer-events-none absolute top-0 left-0 w-full h-full"
			style="z-index: 4;"
			options={sanitizedOptions}
			{url}
			on:particlesLoaded={onParticlesLoaded}
		/>
	{/key}
{/if}
