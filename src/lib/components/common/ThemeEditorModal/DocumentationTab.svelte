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
					lang="json"
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
					<strong>name:</strong> The display name of the theme.
				</li>
				<li>
					<strong>description:</strong> A brief description of the theme.
				</li>
				<li>
					<strong>author:</strong> The creator of the theme.
				</li>
				<li>
					<strong>version:</strong> The version of the theme.
				</li>
				<li>
					<strong>base:</strong> The base theme to inherit styles from. Can be 'light' or 'dark'. Your
					theme will be applied on top of this.
				</li>
				<li><strong>emoji:</strong> An emoji key to identify your theme.</li>
				<li>
					<strong>variables:</strong> Define custom values for the core CSS variables. This is the primary
					way to change the colors of the UI.
				</li>
				<li>
					<strong>css:</strong> Add custom CSS rules to style the UI. This is for more advanced styling
					that can't be achieved with variables alone.
				</li>
				<li>
					<strong>gradient:</strong> Configuration for the background gradient (colors, direction, intensity).
				</li>
				<li>
					<strong>codeMirrorTheme:</strong> The color theme for code blocks.
				</li>
				<li>
					<strong>metaThemeColor:</strong> The color used for the browser's theme color meta tag.
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

	<Collapsible title="Using System Fonts" open={false}>
		<div slot="content" class="pt-2">
			<p>
				For security reasons, the theme system <strong>blocks external resources</strong> such as
				<code>@import</code> and <code>url()</code>. This prevents data exfiltration and tracking.
			</p>
			<p class="mt-2">
				You can still customize your theme's typography by using <strong>system font stacks</strong>.
				These utilize fonts already installed on the user's device, ensuring privacy and instant
				loading.
			</p>

			<hr class="my-4 border-gray-200 dark:border-gray-700" />

			<h4 class="font-semibold mb-2">How to Apply</h4>
			<p class="mb-2">
				Add the following to your <strong>Custom CSS</strong> field to override the global font
				family:
			</p>
			<CodeBlock
				code={`body, button, input, textarea {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}`}
				lang="css"
				edit={false}
			/>

			<hr class="my-4 border-gray-200 dark:border-gray-700" />

			<h4 class="font-semibold mb-2">Recommended Font Stacks</h4>
			<p class="mb-2 text-gray-500">
				Copy/paste these into the <code>font-family</code> rule above:
			</p>

			<ul class="list-disc list-inside space-y-2">
				<li>
					<strong>Modern Sans:</strong> <code>'Inter', system-ui, sans-serif</code>
				</li>
				<li>
					<strong>Monospace (Code):</strong> <code>'Fira Code', 'JetBrains Mono', monospace</code>
				</li>
				<li>
					<strong>Serif (Classic):</strong> <code>'Georgia', 'Times New Roman', serif</code>
				</li>
				<li>
					<strong>Native MacOS:</strong> <code>-apple-system, BlinkMacSystemFont</code>
				</li>
				<li>
					<strong>Native Windows:</strong> <code>"Segoe UI", "Tahoma"</code>
				</li>
			</ul>
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
