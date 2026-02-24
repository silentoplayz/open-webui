<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import Tooltip from '../common/Tooltip.svelte';

	export let history = { messages: {} };
	export let messagesContainerElement: HTMLElement | null = null;

	let scrollbarElement: HTMLElement;
	let thumbElement: HTMLElement;
	let trackElement: HTMLElement;

	let notches = [];
	let resizeObserver: ResizeObserver;

	let thumbHeight = 0;
	let thumbTop = 0;
	let isDragging = false;
	let startY = 0;
	let startScrollTop = 0;

	const updateNotches = () => {
		if (!messagesContainerElement) return;

		const userMessages = Object.values(history.messages).filter(
			(message) => message.role === 'user'
		);

		const scrollHeight = messagesContainerElement.scrollHeight;

		notches = userMessages
			.map((message) => {
				const messageElement = document.getElementById(`message-${message.id}`);
				if (!messageElement) return null;

				const messageOffsetTop = messageElement.offsetTop;
				const position = (messageOffsetTop / scrollHeight) * 100;

				return {
					id: message.id,
					position: position,
					content:
						message.content.length > 50
							? `${message.content.substring(0, 50)}...`
							: message.content
				};
			})
			.filter(Boolean);
	};

	const updateThumb = () => {
		if (!messagesContainerElement) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainerElement;

		thumbHeight = (clientHeight / scrollHeight) * 100;
		thumbTop = (scrollTop / scrollHeight) * 100;
	};

	const handleScroll = () => {
		if (!isDragging) {
			updateThumb();
		}
	};

	const scrollToMessage = (messageId) => {
		const messageElement = document.getElementById(`message-${messageId}`);
		if (messageElement) {
			messageElement.scrollIntoView({ behavior: 'smooth' });
		}
	};

	const handleMouseDown = (event: MouseEvent) => {
		if (!messagesContainerElement) return;
		isDragging = true;
		startY = event.clientY;
		startScrollTop = messagesContainerElement.scrollTop;

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (event: MouseEvent) => {
		if (!isDragging || !messagesContainerElement || !trackElement) return;

		const deltaY = event.clientY - startY;
		const trackHeight = trackElement.clientHeight;
		const scrollHeight = messagesContainerElement.scrollHeight;

		const deltaScrollTop = (deltaY / trackHeight) * scrollHeight;
		messagesContainerElement.scrollTop = startScrollTop + deltaScrollTop;
		updateThumb();
	};

	const handleMouseUp = () => {
		isDragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	};

	onMount(() => {
		if (messagesContainerElement) {
			messagesContainerElement.addEventListener('scroll', handleScroll);

			resizeObserver = new ResizeObserver(() => {
				tick().then(() => {
					updateNotches();
					updateThumb();
				});
			});
			resizeObserver.observe(messagesContainerElement);
		}
		tick().then(() => {
			updateNotches();
			updateThumb();
		});
	});

	onDestroy(() => {
		if (messagesContainerElement) {
			messagesContainerElement.removeEventListener('scroll', handleScroll);
			if (resizeObserver) {
				resizeObserver.unobserve(messagesContainerElement);
			}
		}
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	});

	$: if (history) {
		tick().then(() => {
			updateNotches();
			updateThumb();
		});
	}
</script>

<div class="scrollbar-container" bind:this={scrollbarElement}>
	<div class="scrollbar-track" bind:this={trackElement}>
		<div
			class="scrollbar-thumb"
			bind:this={thumbElement}
			style="height: {thumbHeight}%; top: {thumbTop}%;"
			on:mousedown={handleMouseDown}
		/>
		{#each notches as notch}
			<Tooltip content={notch.content} placement="left">
				<div
					class="scrollbar-notch"
					style="top: {notch.position}%"
					on:click={() => scrollToMessage(notch.id)}
				/>
			</Tooltip>
		{/each}
	</div>
</div>