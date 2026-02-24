<script lang="ts">
	import type { Banner } from '$lib/types';
	import { onMount, createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	const dispatch = createEventDispatcher();

	export let banner: Banner = {
		id: '',
		type: 'info',
		title: '',
		content: '',
		url: '',
		dismissable: true,
		timestamp: Math.floor(Date.now() / 1000)
	};
	export let className = 'mx-4';

	export let dismissed = false;

	let mounted = false;

	const classNames: Record<string, string> = {
		info: 'bg-blue-500/20 text-blue-700 dark:text-blue-200 ',
		success: 'bg-green-500/20 text-green-700 dark:text-green-200',
		warning: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-200',
		error: 'bg-red-500/20 text-red-700 dark:text-red-200'
	};

	const dismiss = (id) => {
		dismissed = true;
		dispatch('dismiss', id);
	};

	onMount(() => {
		mounted = true;
	});

	// Configure DOMPurify to allow details and summary tags
	const purifyOptions = {
		ADD_TAGS: ['details', 'summary']
		// ADD_ATTR: ['open'] // Uncomment if you use the 'open' attribute on <details>
	};

	// Function to process content: handle details, summary, and markdown
	function processBannerContent(content: string): string {
		const sanitizedContent = DOMPurify.sanitize(content, purifyOptions);

		// Regex to find <details> tag at the beginning, capturing its full inner content
		const detailsWrapperRegex = /^\s*<details(?:[^>]*?)>([\s\S]*?)<\/details>\s*(.*)/i;
		const detailsMatch = sanitizedContent.match(detailsWrapperRegex);

		if (detailsMatch) {
			let detailsInnerHtml = detailsMatch[1]; // Content inside <details>...</details>
			const remainingContentAfterDetails = detailsMatch[2]; // Content after the <details> block

			// Now, parse the content *within* the details for <summary> and other Markdown
			const summaryRegex = /^\s*<summary(?:[^>]*?)>([\s\S]*?)<\/summary>\s*(.*)/i;
			const summaryMatch = detailsInnerHtml.match(summaryRegex);

			let finalDetailsInnerContent = '';

			if (summaryMatch) {
				const summaryText = summaryMatch[1]; // Content inside <summary>...</summary>
				const contentAfterSummary = summaryMatch[2]; // Content after the </summary> tag

				// Parse Markdown in summary text
				const parsedSummaryText = marked.parseInline(summaryText).trim(); // Use marked.parseInline for summary
				const reconstructedSummary = `<summary>${parsedSummaryText}</summary>`;

				// Parse Markdown in content after summary
				const parsedContentAfterSummary = marked.parse(contentAfterSummary);

				finalDetailsInnerContent = reconstructedSummary + parsedContentAfterSummary;
			} else {
				// If no <summary> found at the beginning of details content, treat all as markdown
				finalDetailsInnerContent = marked.parse(detailsInnerHtml);
			}

			// Reconstruct the full details block
			const fullDetailsBlock = `<details>${finalDetailsInnerContent}</details>`;

			// Parse any remaining content as Markdown
			const parsedRemainingContent = marked.parse(remainingContentAfterDetails);

			// Combine them.
			return fullDetailsBlock + parsedRemainingContent;
		} else {
			// If no <details> tag at the beginning, just parse the whole thing as Markdown
			return marked.parse(sanitizedContent);
		}
	}

	$: processedContent = processBannerContent(banner.content);
</script>

{#if !dismissed}
	{#if mounted}
		<div
			class="{className} top-0 left-0 right-0 p-2 px-3 flex justify-center items-center relative rounded-xl border border-gray-100 dark:border-gray-850 text-gray-800 dark:text-gary-100 bg-white dark:bg-gray-900 backdrop-blur-xl z-30"
			transition:fade={{ delay: 100, duration: 300 }}
		>
			<div class=" flex flex-col md:flex-row md:items-center flex-1 text-sm w-fit gap-1.5">
				<div class="flex justify-between self-start">
					<div
						class=" text-xs font-bold {classNames[banner.type] ??
							classNames['info']}  w-fit px-2 rounded-sm uppercase line-clamp-1 mr-0.5"
					>
						{banner.type}
					</div>

					{#if banner.url}
						<div class="flex md:hidden group w-fit md:items-center">
							<a
								class="text-gray-700 dark:text-white text-xs font-semibold underline"
								href="/assets/files/whitepaper.pdf"
								target="_blank">Learn More</a
							>

							<div
								class=" ml-1 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white"
							>
								<!--  -->
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 16 16"
									fill="currentColor"
									class="w-4 h-4"
								>
									<path
										fill-rule="evenodd"
										d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex-1 text-xs text-gray-700 dark:text-white max-h-20 overflow-y-auto">
					{@html processedContent}
				</div>
			</div>

			{#if banner.url}
				<div class="hidden md:flex group w-fit md:items-center">
					<a
						class="text-gray-700 dark:text-white text-xs font-semibold underline"
						href="/"
						target="_blank">Learn More</a
					>

					<div class=" ml-1 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white">
						<!--  -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 16 16"
							fill="currentColor"
							class="size-4"
						>
							<path
								fill-rule="evenodd"
								d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				</div>
			{/if}
			<div class="flex self-start">
				{#if banner.dismissible}
					<button
						on:click={() => {
							dismiss(banner.id);
						}}
						class="  -mt-1 -mb-2 -translate-y-[1px] ml-1.5 mr-1 text-gray-400 dark:hover:text-white"
						>×</button
					>
				{/if}
			</div>
		</div>
	{/if}
{/if}
