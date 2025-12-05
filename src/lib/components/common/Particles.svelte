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
</script>

{#if ParticlesComponent}
	{#key currentOptions}
		<svelte:component
			this={ParticlesComponent}
			id="tsparticles"
			class="pointer-events-none absolute top-0 left-0 w-full h-full"
			style="z-index: 4;"
			{options}
			{url}
			on:particlesLoaded={onParticlesLoaded}
		/>
	{/key}
{/if}
