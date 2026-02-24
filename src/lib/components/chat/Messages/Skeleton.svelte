<script lang="ts">
	import { onMount } from 'svelte';

	export let size = 'md';
	export let numRows = 5; // Changed default to 5 to ensure the fifth row effect is visible

	// Segment dimensions (relative to a row's 100% width)
	export let minSegmentWidth = 10; // Minimum percentage width for a single segment
	export let maxSegmentWidth = 60; // Maximum percentage width for a single segment

	// Adjusted Gap Parameters (smaller range for closer gaps)
	export let minSegmentGap = 1; // Minimum percentage gap between segments (e.g., 1%)
	export let maxSegmentGap = 4; // Maximum percentage gap between segments (e.g., 4%)

	// Parameters for a chance of closer gaps
	export let closerGapChance = 0.6; // 60% chance to generate a closer gap
	export let minCloseSegmentGap = 0.5; // Minimum percentage for closer gaps (e.g., 0.5%)
	export let maxCloseSegmentGap = 2; // Maximum percentage for closer gaps (e.g., 2%)

	// Define the structure for a single segment
	type Segment = {
		width: number; // Percentage width
		gapBefore?: number; // Optional: Percentage margin-left for this segment (only if it's not the first in a row)
	};

	// Define the structure for a row, which contains multiple segments
	type Row = Segment[];

	let rows: Row[] = [];

	function generateSkeletonRows() {
		rows = []; // Clear existing rows

		for (let r = 0; r < numRows; r++) {
			const currentRow: Segment[] = [];
			let currentWidthUsed = 0; // Tracks total width (segments + their preceding gaps) for the current row

			// Determine the target width for the current row
			let targetRowWidth = 100; // Default for most rows
			if (r === 4) {
				// For the fifth row (0-indexed)
				// It should end somewhere between a third (33%) and halfway (50%)
				targetRowWidth = Math.random() * (50 - 33) + 33;
			}

			// Loop to add segments until we decide to add the final, fitting segment
			while (true) {
				const segmentWidth = Math.random() * (maxSegmentWidth - minSegmentWidth) + minSegmentWidth;

				// Generate random gap ONLY IF it's not the first segment in the row
				let segmentGap = 0;
				if (currentRow.length > 0) {
					if (Math.random() < closerGapChance) {
						segmentGap =
							Math.random() * (maxCloseSegmentGap - minCloseSegmentGap) + minCloseSegmentGap;
					} else {
						segmentGap = Math.random() * (maxSegmentGap - minSegmentGap) + minSegmentGap;
					}
				}

				const potentialNextWidth = currentWidthUsed + segmentGap + segmentWidth;

				// Condition to stop adding random segments and prepare for the final one
				// Check against `targetRowWidth` instead of fixed 100%
				if (
					// If adding this segment would exceed `targetRowWidth` (or get very close leaving less than minSegmentWidth)
					potentialNextWidth > targetRowWidth - minSegmentWidth - minCloseSegmentGap ||
					// OR, if this is not the first segment, and we randomly decide to end the row
					(currentRow.length > 0 && Math.random() < 0.3) // 30% chance to end the row (tweak this!)
				) {
					// Calculate width for the final segment to fill remaining space up to `targetRowWidth`
					let finalSegmentGap = currentRow.length > 0 ? segmentGap : 0; // Use the gap calculated for this potential segment
					let finalSegmentWidth = targetRowWidth - currentWidthUsed - finalSegmentGap;

					// Ensure the final segment is at least minSegmentWidth, or adjust previous segment
					if (finalSegmentWidth < minSegmentWidth) {
						if (currentRow.length === 0) {
							// If this is the only segment and `targetRowWidth` is less than `minSegmentWidth`,
							// just make this segment fill the `targetRowWidth`.
							currentRow.push({ width: targetRowWidth });
						} else {
							// If we have existing segments, and the remaining space is too small
							// for a new minSegmentWidth segment, extend the last segment to fill the remainder.
							const lastSegment = currentRow.pop();
							if (lastSegment) {
								const currentWidthBeforeLast =
									currentWidthUsed - lastSegment.width - (lastSegment.gapBefore || 0);
								const newLastSegmentWidth = targetRowWidth - currentWidthBeforeLast;
								currentRow.push({
									width: newLastSegmentWidth,
									gapBefore: lastSegment.gapBefore
								});
							}
						}
					} else {
						// Add the final segment that fills the remaining space
						currentRow.push({ width: finalSegmentWidth, gapBefore: finalSegmentGap });
					}
					break; // Exit the while loop for this row
				}

				// If we reached here, the segment fits normally and we are continuing the row
				currentRow.push({ width: segmentWidth, gapBefore: segmentGap });
				currentWidthUsed += segmentGap + segmentWidth;
			}
			rows.push(currentRow);
		}
	}

	onMount(() => {
		generateSkeletonRows();
	});
</script>

<div class="w-full mt-2 mb-2">
	<div class="animate-pulse flex w-full">
		<div class="{size === 'md' ? 'space-y-2' : 'space-y-1.5'} w-full">
			{#each rows as row, rowIndex}
				<div class="flex w-full justify-start items-center">
					{#each row as segment, segmentIndex}
						<div
							class="{size === 'md'
								? 'h-2'
								: 'h-1.5'} bg-gray-200 dark:bg-gray-600 rounded-sm skeleton-line"
							style="width: {segment.width}%; {segment.gapBefore !== undefined
								? `margin-left: ${segment.gapBefore}%;`
								: ''} animation-delay: {rowIndex * 0.07}s;"
						/>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<style lang="postcss">
	/* --- Base Styling for Skeleton Lines with Shine Effect --- */
	.skeleton-line {
		overflow: hidden; /* Crucial for the ::before pseudo-element's animation */
		position: relative; /* Context for absolute positioning of ::before */
	}

	/* The "Bounce Shine" Effect (moving and undulating gradient) */
	.skeleton-line::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		/*
		   Width of 300% and height of 200% ensure the diagonal shine can fully
		   traverse the element. You might need to adjust these based on the exact angle.
		*/
		width: 300%;
		height: 200%;
		transform: translate(-100%, -100%); /* Start completely off-screen top-left */
		animation: bounceShine 3s infinite ease-in-out; /* Slower, more pronounced animation */
	}

	/* Custom properties for easy color adjustment in light/dark mode */
	.skeleton-line::before {
		--shine-color-start: rgba(255, 255, 255, 0.4);
		--shine-color-peak: rgba(255, 255, 255, 0.6);
		--shine-color-end: rgba(255, 255, 255, 0.4);
	}

	.dark .skeleton-line::before {
		--shine-color-start: rgba(255, 255, 255, 0.15);
		--shine-color-peak: rgba(255, 255, 255, 0.25);
		--shine-color-end: rgba(255, 255, 255, 0.15);
	}

	/* Define the gradient with a 135deg angle */
	@property --gradient-pos-1 {
		syntax: '<percentage>';
		initial-value: 0%;
		inherits: false;
	}
	@property --gradient-pos-2 {
		syntax: '<percentage>';
		initial-value: 10%;
		inherits: false;
	}
	@property --gradient-pos-3 {
		syntax: '<percentage>';
		initial-value: 20%;
		inherits: false;
	}
	@property --gradient-pos-4 {
		syntax: '<percentage>';
		initial-value: 30%;
		inherits: false;
	}
	@property --gradient-pos-5 {
		syntax: '<percentage>';
		initial-value: 40%;
		inherits: false;
	}

	/* Initial background for the element (uses custom properties) */
	.skeleton-line::before {
		background: linear-gradient(
			135deg,
			/* Diagonal direction */ transparent var(--gradient-pos-1),
			var(--shine-color-start) var(--gradient-pos-2),
			var(--shine-color-peak) var(--gradient-pos-3),
			var(--shine-color-end) var(--gradient-pos-4),
			transparent var(--gradient-pos-5)
		);
	}

	@keyframes bounceShine {
		0% {
			transform: translate(-100%, -100%); /* Start completely off top-left */
			--gradient-pos-1: 0%;
			--gradient-pos-2: 10%;
			--gradient-pos-3: 20%;
			--gradient-pos-4: 30%;
			--gradient-pos-5: 40%;
		}
		25% {
			transform: translate(0%, 0%); /* First "bounce" in, aligned with element's top-left */
			--gradient-pos-1: 0%;
			--gradient-pos-2: 5%; /* Expand slightly */
			--gradient-pos-3: 15%;
			--gradient-pos-4: 25%;
			--gradient-pos-5: 35%;
		}
		50% {
			transform: translate(100%, 100%); /* Middle of the sweep, another "bounce" */
			--gradient-pos-1: 0%;
			--gradient-pos-2: 12%; /* Contract slightly */
			--gradient-pos-3: 22%;
			--gradient-pos-4: 32%;
			--gradient-pos-5: 42%;
		}
		75% {
			transform: translate(200%, 200%); /* Last "bounce" before going off */
			--gradient-pos-1: 0%;
			--gradient-pos-2: 8%; /* Expand again */
			--gradient-pos-3: 18%;
			--gradient-pos-4: 28%;
			--gradient-pos-5: 38%;
		}
		100% {
			transform: translate(300%, 300%); /* End completely off bottom-right */
			--gradient-pos-1: 0%;
			--gradient-pos-2: 10%;
			--gradient-pos-3: 20%;
			--gradient-pos-4: 30%;
			--gradient-pos-5: 40%;
		}
	}
</style>
