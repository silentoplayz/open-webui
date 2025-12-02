<script lang="ts">
	/**
	 * @component ThemeManager
	 * This is a logic-only Svelte component responsible for managing and applying
	 * container-specific theme customizations, such as gradients and animations.
	 * It listens to the live theme store and applies changes to the container element
	 * passed to it as a prop.
	 *
	 * @prop {HTMLElement} container - The HTML element to which the theme customizations will be applied.
	 */
	import type { Theme } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { liveThemeStore } from '$lib/stores/theme';

	export let container: HTMLElement;

	let lastTheme: Theme | undefined = undefined;
	let currentAnimation: Theme['animation'] | undefined;
	let currentResizeObserver: ResizeObserver | undefined;

	// Helper to check if gradient changed
	const isGradientChanged = (newTheme: Theme, oldTheme: Theme | undefined) => {
		if (!oldTheme) return true;
		const newG = newTheme.gradient;
		const oldG = oldTheme.gradient;
		const newEnabled =
			(!newTheme.toggles ||
				typeof newTheme.toggles.gradient === 'undefined' ||
				newTheme.toggles.gradient) &&
			newG?.enabled;
		const oldEnabled =
			(!oldTheme.toggles ||
				typeof oldTheme.toggles.gradient === 'undefined' ||
				oldTheme.toggles.gradient) &&
			oldG?.enabled;

		if (newEnabled !== oldEnabled) return true;
		if (!newEnabled) return false; // Both disabled, no change needed

		// Compare gradient properties
		return (
			newG?.direction !== oldG?.direction ||
			newG?.intensity !== oldG?.intensity ||
			JSON.stringify(newG?.colors) !== JSON.stringify(oldG?.colors)
		);
	};

	// Helper to check if animation changed
	const isAnimationChanged = (newTheme: Theme, oldTheme: Theme | undefined) => {
		if (!oldTheme) return true;
		const newScript = newTheme.animationScript;
		const oldScript = oldTheme.animationScript;
		const newEnabled = !newTheme.toggles || newTheme.toggles.animationScript;
		const oldEnabled = !oldTheme.toggles || oldTheme.toggles.animationScript;

		if (newEnabled !== oldEnabled) return true;
		if (!newEnabled) return false;

		return newScript !== oldScript;
	};

	const cleanupAnimation = (mainContainer: HTMLElement, themeId: string) => {
		if (currentAnimation && typeof currentAnimation.stop === 'function') {
			currentAnimation.stop();
		}
		currentAnimation = undefined;

		const canvas = mainContainer.querySelector(`[id$='-canvas']`);
		if (canvas) {
			canvas.remove();
		}

		if (currentResizeObserver) {
			currentResizeObserver.disconnect();
			currentResizeObserver = undefined;
		}

		const script = document.getElementById(`${themeId}-script`);
		if (script) {
			script.remove();
		}

		if (window.cleanupDoomTheme) {
			window.cleanupDoomTheme();
			delete window.cleanupDoomTheme;
		}
	};

	const cleanupCustomizations = (theme: Theme, mainContainer: HTMLElement) => {
		if (!mainContainer) return;
		cleanupAnimation(mainContainer, theme.id);

		mainContainer.classList.remove(`${theme.id}-bg`);
		mainContainer.style.backgroundImage = 'none';

		const gradientLayer = mainContainer.querySelector('#theme-gradient-layer');
		if (gradientLayer) {
			gradientLayer.remove();
		}
	};

	const applyCustomizations = (
		theme: Theme,
		oldTheme: Theme | undefined,
		mainContainer: HTMLElement
	) => {
		if (!mainContainer) return;

		// --- Gradient Handling ---
		if (isGradientChanged(theme, oldTheme)) {
			const gradientLayer = mainContainer.querySelector('#theme-gradient-layer');
			if (
				theme.gradient &&
				(!theme.toggles ||
					typeof theme.toggles.gradient === 'undefined' ||
					theme.toggles.gradient) &&
				theme.gradient.enabled &&
				theme.gradient.colors.length > 0
			) {
				const { colors, direction, intensity } = theme.gradient;
				const alpha = (intensity ?? 100) / 100;
				const rgbaColors = colors.map((hex) => {
					if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
						let c = hex.substring(1).split('');
						if (c.length === 3) {
							c = [c[0], c[0], c[1], c[1], c[2], c[2]];
						}
						c = '0x' + c.join('');
						const r = (c >> 16) & 255;
						const g = (c >> 8) & 255;
						const b = c & 255;
						return `rgba(${r}, ${g}, ${b}, ${alpha})`;
					}
					return `rgba(0, 0, 0, ${alpha})`;
				});
				const gradientCss = `linear-gradient(${direction}deg, ${rgbaColors.join(', ')})`;

				if (gradientLayer && gradientLayer instanceof HTMLElement) {
					// Update existing layer
					gradientLayer.style.backgroundImage = gradientCss;
				} else {
					// Create new layer
					const newLayer = document.createElement('div');
					newLayer.id = 'theme-gradient-layer';
					newLayer.style.position = 'absolute';
					newLayer.style.top = '0';
					newLayer.style.left = '0';
					newLayer.style.width = '100%';
					newLayer.style.height = '100%';
					newLayer.style.zIndex = '3';
					newLayer.style.backgroundImage = gradientCss;
					mainContainer.prepend(newLayer);
				}
			} else {
				// Remove gradient if disabled
				if (gradientLayer) {
					gradientLayer.remove();
				}
			}
		}

		// --- Background Image Handling ---
		// Always update these as they are cheap operations
		if (oldTheme && oldTheme.id !== theme.id) {
			mainContainer.classList.remove(`${oldTheme.id}-bg`);
		}
		mainContainer.classList.add(`${theme.id}-bg`);

		// Only update background image if it changed (optimization)
		if (
			!oldTheme ||
			theme.systemBackgroundImageUrl !== oldTheme.systemBackgroundImageUrl ||
			theme.toggles?.systemBackgroundImage !== oldTheme.toggles?.systemBackgroundImage
		) {
			// Logic handled by CSS classes usually, but if inline styles were used:
			// mainContainer.style.backgroundImage = ...
			// Current implementation seems to rely on global CSS or classes for bg image,
			// except the cleanup removed it.
			// The original code set mainContainer.style.backgroundImage = 'none' in cleanup.
			// If the theme system uses CSS variables for BG images, we might not need to do anything here.
			// But let's respect the original behavior:
			// Original code didn't set backgroundImage here, only removed it in cleanup.
			// So we assume CSS handles it.
		}

		// --- Animation Handling ---
		if (isAnimationChanged(theme, oldTheme)) {
			// Cleanup old animation
			if (oldTheme) {
				cleanupAnimation(mainContainer, oldTheme.id);
			}

			// Apply new animation
			if (theme.animationScript && (!theme.toggles || theme.toggles.animationScript)) {
				if (
					theme.animationScript.includes('document.') ||
					theme.animationScript.includes('window.')
				) {
					// Run in main thread
					const script = document.createElement('script');
					script.textContent = theme.animationScript;
					script.id = `${theme.id}-script`;
					document.head.appendChild(script);
				} else {
					// Run in worker
					const canvas = document.createElement('canvas');
					canvas.id = `${theme.id}-canvas`;
					canvas.style.position = 'absolute';
					canvas.style.top = '0';
					canvas.style.left = '0';
					canvas.style.width = '100%';
					canvas.style.height = '100%';
					canvas.style.zIndex = '0';
					canvas.style.pointerEvents = 'none';
					canvas.style.opacity = '0';
					canvas.style.transition = 'opacity 0.5s ease-in-out';
					mainContainer.prepend(canvas);

					try {
						const blob = new Blob([theme.animationScript], { type: 'application/javascript' });
						const workerUrl = URL.createObjectURL(blob);
						const worker = new Worker(workerUrl);

						const offscreen = canvas.transferControlToOffscreen();

						const rect = mainContainer.getBoundingClientRect();
						worker.postMessage(
							{ type: 'init', canvas: offscreen, width: rect.width, height: rect.height },
							[offscreen]
						);

						currentResizeObserver = new ResizeObserver((entries) => {
							if (entries.length > 0) {
								const entry = entries[0];
								worker.postMessage({
									type: 'resize',
									width: entry.contentRect.width,
									height: entry.contentRect.height
								});
							}
						});
						currentResizeObserver.observe(mainContainer);

						mainContainer.addEventListener('mousemove', (e) => {
							const rect = mainContainer.getBoundingClientRect();
							worker.postMessage({
								type: 'mousemove',
								x: e.clientX - rect.left,
								y: e.clientY - rect.top
							});
						});

						currentAnimation = {
							start: () => {},
							stop: () => {
								worker.terminate();
								URL.revokeObjectURL(workerUrl);
								if (currentResizeObserver) {
									currentResizeObserver.disconnect();
								}
							}
						};
					} catch (e) {
						console.error('Failed to start animation worker:', e);
					}

					setTimeout(() => {
						window.dispatchEvent(new Event('resize'));
						canvas.style.opacity = '1';
					}, 100);
				}
			} else if (theme.animation && typeof theme.animation.start === 'function') {
				const canvas = document.createElement('canvas');
				canvas.id = `${theme.id}-canvas`;
				canvas.style.position = 'absolute';
				canvas.style.top = '0';
				canvas.style.left = '0';
				canvas.style.width = '100%';
				canvas.style.height = '100%';
				canvas.style.zIndex = '0';
				canvas.style.pointerEvents = 'none';
				canvas.style.opacity = '0';
				canvas.style.transition = 'opacity 0.5s ease-in-out';
				mainContainer.prepend(canvas);

				currentAnimation = theme.animation;
				currentAnimation.start(canvas);

				setTimeout(() => {
					window.dispatchEvent(new Event('resize'));
					canvas.style.opacity = '1';
				}, 100);
			}
		}
	};

	onMount(() => {
		const unsubscribe = liveThemeStore.subscribe((theme) => {
			if (!container) {
				return;
			}

			// If theme ID changed, do full cleanup/apply to be safe,
			// or just let the diffing handle it.
			// Diffing handles it, but we need to pass the correct oldTheme.
			if (theme) {
				applyCustomizations(theme, lastTheme, container);
				// Deep clone to prevent reference mutation issues since ThemeEditorModal mutates objects in place
				lastTheme = JSON.parse(JSON.stringify(theme));
			} else if (lastTheme) {
				cleanupCustomizations(lastTheme, container);
				lastTheme = undefined;
			}
		});

		return () => {
			unsubscribe();
			if (lastTheme && container) {
				cleanupCustomizations(lastTheme, container);
			}
		};
	});
</script>
