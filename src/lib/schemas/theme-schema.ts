import { z } from 'zod';

/**
 * Zod schema for theme validation
 * Provides runtime validation and TypeScript type inference
 */

// Theme variable enum values
const themeVariableSchema = z.enum([
	'--color-black',
	'--color-white',
	'--color-gray-50',
	'--color-gray-100',
	'--color-gray-200',
	'--color-gray-300',
	'--color-gray-400',
	'--color-gray-500',
	'--color-gray-600',
	'--color-gray-700',
	'--color-gray-800',
	'--color-gray-850',
	'--color-gray-900',
	'--color-gray-950',
	'--color-blue-100',
	'--color-blue-200',
	'--color-blue-300',
	'--color-blue-400',
	'--color-blue-500',
	'--color-blue-600',
	'--color-blue-700',
	'--color-blue-800',
	'--color-blue-900',
	'--color-blue-950'
]);

// Base theme type
const baseThemeSchema = z.enum(['light', 'dark', 'oled-dark', 'her', 'system']);

// Gradient configuration
const gradientSchema = z
	.object({
		enabled: z.boolean().optional(),
		colors: z.array(z.string()).optional(),
		direction: z.number().optional(),
		intensity: z.number().optional()
	})
	.passthrough();

// Theme toggles
const togglesSchema = z
	.object({
		cssVariables: z.boolean().optional(),
		customCss: z.boolean().optional(),
		animationScript: z.boolean().optional(),
		tsParticles: z.boolean().optional(),
		gradient: z.boolean().optional(),
		systemBackgroundImage: z.boolean().optional(),
		chatBackgroundImage: z.boolean().optional()
	})
	.passthrough();

// Size limits (matching our validation logic)
const MAX_CSS_SIZE = 100 * 1024; // 100KB
const MAX_SCRIPT_SIZE = 50 * 1024; // 50KB

// Main theme schema
export const themeSchema = z
	.object({
		id: z.string().min(1, 'Theme ID must be a non-empty string'),
		name: z.string().min(1, 'Theme name must be a non-empty string'),
		description: z.string().optional(),
		version: z.string().optional(),
		author: z.string().optional(),
		repository: z.string().optional(),
		targetWebUIVersion: z.string().optional(),
		base: baseThemeSchema,
		emoji: z.string().optional(),
		metaThemeColor: z.string().optional(),
		systemBackgroundImageUrl: z.string().optional(),
		systemBackgroundImageDarken: z.number().optional(),
		chatBackgroundImageUrl: z.string().optional(),
		chatBackgroundImageDarken: z.number().optional(),
		variables: z.record(z.string(), z.string()).optional(),
		gradient: gradientSchema.optional(),
		tsparticlesConfig: z.any().optional(), // IOptions type is complex, using any for now
		animationScript: z
			.string()
			.max(MAX_SCRIPT_SIZE, `Animation script must not exceed ${MAX_SCRIPT_SIZE / 1024}KB`)
			.optional(),
		animation: z.any().optional(),
		css: z
			.string()
			.max(MAX_CSS_SIZE, `CSS must not exceed ${MAX_CSS_SIZE / 1024}KB`)
			.optional(),
		sourceUrl: z.string().optional(),
		codeMirrorTheme: z.string().optional(),
		toggles: togglesSchema.optional()
	})
	.passthrough(); // Allow unknown properties for backward compatibility

// Export the inferred type (should match Theme interface)
export type ThemeSchemaType = z.infer<typeof themeSchema>;
