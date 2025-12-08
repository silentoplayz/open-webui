<script lang="ts">
	import { getContext } from 'svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';
	import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';
	import variables from '$lib/themes/variables.json';

	const i18n = getContext('i18n');

	const fullThemeSchema = {
		id: 'custom-theme-example',
		name: 'Custom Theme Example',
		description: 'A brief description of the theme.',
		version: '1.0.0',
		author: 'Your Name',
		repository: 'https://github.com/user/repo',
		targetWebUIVersion: '0.6.29',
		base: 'dark',
		emoji: '🎨',
		metaThemeColor: '#000000',
		systemBackgroundImageUrl: '',
		systemBackgroundImageDarken: 0,
		chatBackgroundImageUrl: '',
		chatBackgroundImageDarken: 30,
		variables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.defaultValue }), {}),
		gradient: {
			enabled: true,
			direction: 45,
			intensity: 100,
			colors: ['#ff0000', '#0000ff']
		},
		tsparticlesConfig: {
			fpsLimit: 120,
			pauseOnBlur: true,
			pauseOnOutsideViewport: true,
			interactivity: {
				events: {
					onClick: {
						enable: false
					}
				}
			}
		},
		animationScript: '',
		css: '/* Custom CSS rules go here */',
		sourceUrl:
			'https://raw.githubusercontent.com/open-webui/open-webui/main/src/lib/themes/oled-dark.json',
		codeMirrorTheme: 'abcdef',
		toggles: {
			cssVariables: true,
			customCss: true,
			animationScript: false,
			tsParticles: true,
			gradient: true,
			systemBackgroundImage: false,
			chatBackgroundImage: false
		}
	};
</script>

<div class="space-y-4 text-sm">
	<Collapsible title="Full Theme Schema" open={false}>
		<div slot="content" class="pt-2">
			<p class="text-gray-500">
				This is the full schema of the JSON file that is acceptable by the theming system.
			</p>
			<div class="mt-2">
				<CodeBlock
					code={JSON.stringify(fullThemeSchema, null, 2)}
					language="json"
					header={false}
					canCopy={true}
					edit={false}
				/>
			</div>
		</div>
	</Collapsible>
	<Collapsible title="Key Theme Properties" open={false}>
		<div slot="content" class="pt-2">
			<p>
				Here are the main properties you can use to define your theme. For a complete guide, refer
				to the <a
					href="https://github.com/open-webui/open-webui/blob/main/docs/THEMES.md"
					target="_blank"
					class="text-blue-500 hover:underline">full documentation</a
				>.
			</p>
			<ul class="mt-2 list-disc list-inside space-y-1">
				<li>
					<strong>base:</strong> The base theme to inherit styles from. Can be 'light' or 'dark'. Your
					theme will be applied on top of this.
				</li>
				<li>
					<strong>description:</strong> A brief description of the theme.
				</li>
				<li>
					<strong>css:</strong> Add custom CSS rules to style the UI. This is for more advanced styling
					that can't be achieved with variables alone.
				</li>
				<li>
					<strong>variables:</strong> Define custom values for the core CSS variables. This is the primary
					way to change the colors of the UI.
				</li>
				<li>
					<strong>animationScript:</strong> Custom Javascript for canvas-based animations.
				</li>
				<li>
					<strong>tsparticlesConfig:</strong> Configuration for modern
					<a href="https://tsparticles.dev" target="_blank" class="text-blue-500 hover:underline"
						>tsParticles</a
					> animations.
				</li>
				<li>
					<strong>systemBackgroundImageUrl:</strong> URL for the system-wide background image.
				</li>
				<li>
					<strong>systemBackgroundImageDarken:</strong> How much to darken the system background image
					(0-100).
				</li>
				<li>
					<strong>chatBackgroundImageUrl:</strong> URL for the chat-specific background image.
				</li>
				<li>
					<strong>chatBackgroundImageDarken:</strong> How much to darken the chat background image (0-100).
				</li>
			</ul>
		</div>
	</Collapsible>

	<Collapsible title="Using Custom Fonts" open={false}>
		<div slot="content" class="pt-2">
			<p>
				The current theme system allows you to embed custom fonts in your theme using the <code
					>css</code
				> property to override the default font family in two ways:
			</p>
			<ol class="mt-2 list-decimal list-inside space-y-1">
				<li>A fast, self-hosted <code>@font-face</code> declaration</li>
				<li>A convenient Google Fonts <code>@import</code> statement</li>
			</ol>
			<p class="mt-2">Both snippets go into the <strong>Custom CSS</strong> field of your theme.</p>

			<hr class="my-4 border-gray-200 dark:border-gray-700" />

			<h4 class="font-semibold mb-2">Option 1 – self-hosted</h4>
			<p class="mb-2">
				If you want the smallest possible file and full control over privacy, reference the raw font
				file directly (<code>.woff2</code> recommended):
			</p>
			<CodeBlock
				code={`@font-face {
  font-family: 'Roboto';
  src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2') format('woff2');
}

body, button, input, textarea {
  font-family: 'Roboto', sans-serif;
}`}
				language="css"
				header={false}
				canCopy={true}
				edit={false}
			/>

			<hr class="my-4 border-gray-200 dark:border-gray-700" />

			<h4 class="font-semibold mb-2">Option 2 – Google Fonts import</h4>
			<p class="mb-2">
				The quickest way to add a Google font is the standard <code>@import</code> statement:
			</p>
			<CodeBlock
				code={`@import url('https://fonts.googleapis.com/css2?family=Orbitron&display=swap');

body {
  font-family: 'Orbitron', sans-serif;
}`}
				language="css"
				header={false}
				canCopy={true}
				edit={false}
			/>

			<p class="mt-4">
				Either block can be used independently; both override the default font for every visible
				part of Open WebUI.
			</p>
		</div>
	</Collapsible>

	<Collapsible title="Animation Resources" open={false}>
		<div slot="content" class="pt-2">
			<p>
				You can create complex particle animations using one of the supported libraries. Use their
				official editors to build your configuration, then paste the exported JSON into the
				corresponding field in the theme editor.
			</p>
			<ul class="mt-2 list-disc list-inside">
				<li>
					<a href="https://particles.js.org/" target="_blank" class="text-blue-500 hover:underline"
						>tsParticles Official Editor & Samples</a
					>
				</li>
			</ul>
		</div>
	</Collapsible>

	<Collapsible title="Available CSS Variables">
		<div slot="content" class="pt-2">
			<p class="text-gray-500">
				Here is a list of all the available CSS variables that you can use to customize your theme.
			</p>

			<div
				class="mt-4 overflow-y-auto overflow-x-auto max-h-96 rounded-lg border border-gray-200 dark:border-gray-700"
			>
				<table class="w-full text-sm text-left">
					<thead
						class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400"
					>
						<tr>
							<th scope="col" class="px-6 py-3 whitespace-nowrap"> Variable </th>
							<th scope="col" class="px-6 py-3 whitespace-nowrap"> Default Value </th>
							<th scope="col" class="px-6 py-3 min-w-[200px]"> Description </th>
						</tr>
					</thead>
					<tbody>
						{#each variables as variable}
							<tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
								<td class="px-6 py-4 font-mono whitespace-nowrap"> {variable.name} </td>
								<td class="px-6 py-4 font-mono whitespace-nowrap">
									<div class="flex items-center gap-2">
										{#if /^#[0-9A-Fa-f]{3,8}$/.test(variable.defaultValue)}
											<div
												class="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm"
												style="background-color: {variable.defaultValue}"
											></div>
										{/if}
										<span>{variable.defaultValue}</span>
									</div>
								</td>
								<td class="px-6 py-4 min-w-[200px]"> {variable.description} </td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</Collapsible>
</div>
