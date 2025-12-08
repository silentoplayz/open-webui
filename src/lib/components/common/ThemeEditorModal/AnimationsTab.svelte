<script lang="ts">
	import { createEventDispatcher, getContext } from 'svelte';
	import type { Theme } from '$lib/types';
	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';

	export let themeCopy: Theme;
	export let animationScriptText: string;
	export let tsParticleConfigText: string;

	// Check validity of initial prop
	let isJsonValid = true;
	$: {
		try {
			if (tsParticleConfigText && tsParticleConfigText.trim()) {
				JSON.parse(tsParticleConfigText);
			}
			isJsonValid = true;
		} catch {
			isJsonValid = false;
		}
	}

	const dispatch = createEventDispatcher();
	const i18n = getContext('i18n');

	const handleAnimationScriptInput = (e) => {
		animationScriptText = e.detail;
		themeCopy.animationScript = animationScriptText;
		dispatch('update', { ...themeCopy });
	};

	const handleTsParticleConfigInput = (e) => {
		tsParticleConfigText = e.detail;
		try {
			if (tsParticleConfigText.trim()) {
				themeCopy.tsparticlesConfig = JSON.parse(tsParticleConfigText);
				isJsonValid = true;
				// Only dispatch update if valid
				dispatch('update', { ...themeCopy });
			} else {
				// Empty is considered valid (no config)
				themeCopy.tsparticlesConfig = undefined;
				isJsonValid = true;
				dispatch('update', { ...themeCopy });
			}
		} catch (error) {
			isJsonValid = false;
			// Don't dispatch update if invalid to prevent breaking the app ref
		}
	};
</script>

<div class="space-y-4">
	<div>
		<div class="flex items-center gap-2">
			<Switch
				bind:state={themeCopy.toggles.animationScript}
				on:change={() => {
					// Only dispatch update if there's actual content to apply
					if (animationScriptText?.trim()) {
						dispatch('update', { ...themeCopy });
					}
				}}
			/>
			<Tooltip
				content="Add custom Javascript to create animations. This is for advanced themes that use canvas or other dynamic elements."
			>
				<label
					for="theme-animation-script"
					class="block text-sm font-medium text-gray-700 dark:text-gray-300"
					>{$i18n.t('Animation Script')}</label
				>
			</Tooltip>
		</div>
		{#if themeCopy.toggles.animationScript}
			{#key 'animation-script'}
				<div class="mt-1 rounded-lg overflow-hidden">
					<CodeBlock
						id="theme-animation-script-editor"
						code={animationScriptText}
						lang={'javascript'}
						edit={true}
						on:change={handleAnimationScriptInput}
					/>
				</div>
			{/key}
		{/if}
	</div>
	<div>
		<div class="flex items-center gap-2">
			<Switch
				bind:state={themeCopy.toggles.tsParticles}
				on:change={() => {
					// Only dispatch update if there's valid config to apply
					if (tsParticleConfigText?.trim()) {
						try {
							JSON.parse(tsParticleConfigText);
							dispatch('update', { ...themeCopy });
						} catch {
							// Don't dispatch if JSON is invalid
						}
					}
				}}
			/>
			<Tooltip content="Configuration object for tsParticles animations.">
				<label
					for="theme-tsparticle-config"
					class="block text-sm font-medium text-gray-700 dark:text-gray-300"
					>{$i18n.t('tsParticles Config')}</label
				>
			</Tooltip>
		</div>
		{#if themeCopy.toggles.tsParticles}
			{#key 'tsparticles-config'}
				<div class="mt-1 rounded-lg overflow-hidden">
					<CodeBlock
						id="theme-tsparticle-config-editor"
						code={tsParticleConfigText}
						lang={'json'}
						edit={true}
						on:change={handleTsParticleConfigInput}
					/>
				</div>
				<div class="mt-1 flex justify-end">
					<span
						class="text-xs transition-colors {isJsonValid
							? 'text-green-500'
							: 'text-red-500 font-medium'}"
					>
						{isJsonValid ? 'Valid JSON' : 'Invalid JSON'}
					</span>
				</div>
			{/key}
		{/if}
	</div>
</div>
