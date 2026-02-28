import * as z from 'zod';

/**
 * Coerce values to strings for XML text content
 */
const OptionalStringSchema = z
	.union([z.string(), z.number()])
	.transform((val) => String(val))
	.optional();

/**
 * Boolean schema that accepts boolean or string 'true'/'false'
 */
const BooleanSchema = z
	.union([z.boolean(), z.literal('true'), z.literal('false'), z.string()])
	.transform((val) => {
		if (typeof val === 'boolean') {
			return val;
		}
		if (val === 'true') {
			return true;
		}
		if (val === 'false') {
			return false;
		}
		return Boolean(val);
	});

/**
 * Number schema that accepts numbers or numeric strings
 */
const NumberSchema = z.union([z.number(), z.string()]).transform((val) => {
	if (typeof val === 'number') {
		return val;
	}
	return Number.parseFloat(val);
});

/**
 * Property value schema for <property> tags
 */
export const PropertyValueSchema = z.object({
	type: z.enum(['string', 'bool', 'int', 'double']).default('string'),
	value: z.any(),
});

/**
 * Properties schema - record of property name to property value.
 * Accepts both { type, value } format and flat primitive values.
 */
export const PropertiesSchema = z
	.record(z.string(), z.union([PropertyValueSchema, z.string(), z.number(), z.boolean()]))
	.optional();

/**
 * Module schema for <module> elements
 */
export const ModuleSchema = z.object({
	moduleid: z.string().min(1, { message: 'Module must have an id' }),
	platform: z
		.string()
		.refine((val) => val === val.toLowerCase(), { message: 'Module "platform" must be lowercase' })
		.optional(),
	version: z
		.union([z.string(), z.number()])
		.transform((val) => String(val))
		.refine((val) => /^\d+(\.\d+)?(\.\d+)?$/.test(val), {
			message: 'Module version is invalid',
		})
		.optional(),
	deployType: z.enum(['production', 'test', 'development']).optional(),
});

/**
 * Modules schema - array of modules
 */
export const ModulesSchema = z.array(ModuleSchema).optional();

/**
 * Deployment target schema
 */
export const DeploymentTargetsSchema = z
	.record(z.string(), z.union([z.boolean(), z.string()]))
	.optional();

/**
 * iOS capabilities schema
 */
export const IOSCapabilitiesSchema = z
	.object({
		appGroups: z.array(z.string()).optional(),
	})
	.optional();

/**
 * iOS extension target schema
 */
const IOSExtensionTargetSchema = z.object({
	name: z.string(),
	ppUUIDs: z.record(z.string(), z.string()).optional(),
});

/**
 * iOS extension provisioning profile schema
 */
const IOSProvisioningProfileSchema = z.record(z.string(), z.any());

/**
 * iOS extension schema - accepts target/targets and provisioningProfiles
 */
const IOSExtensionSchema = z.object({
	projectPath: z.string(),
	target: z.string().optional(),
	targets: z.array(IOSExtensionTargetSchema).optional(),
	provisioningProfiles: z.array(IOSProvisioningProfileSchema).optional(),
});

/**
 * iOS configuration schema
 */
export const IOSSchema = z
	.object({
		capabilities: IOSCapabilitiesSchema,
		defaultBackgroundColor: OptionalStringSchema,
		enableLaunchScreenStoryboard: BooleanSchema.optional(),
		entitlements: z.record(z.string(), z.any()).optional(),
		extensions: z.array(IOSExtensionSchema).optional(),
		logServerPort: z.number().optional(),
		minIosVer: NumberSchema.optional(),
		plist: z.record(z.string(), z.any()).optional(),
		teamId: OptionalStringSchema,
		useAppThinning: BooleanSchema.optional(),
		useAutolayout: BooleanSchema.optional(),
		useJscoreFramework: BooleanSchema.optional(),
		useNewBuildSystem: BooleanSchema.optional(),
	})
	.optional();

/**
 * Android activity/service item (array element)
 */
const AndroidActivityServiceItemSchema = z.record(z.string(), z.any());

/**
 * Android activity/service schema - accepts array or record format
 */
const AndroidActivityServiceSchema = z.union([
	z.array(AndroidActivityServiceItemSchema),
	z.record(z.string(), z.any()),
]);

/**
 * Android configuration schema
 */
export const AndroidSchema = z
	.object({
		manifest: OptionalStringSchema,
		toolAPILevel: NumberSchema.optional(),
		abi: z.union([z.array(z.string()), z.string()]).optional(),
		activities: AndroidActivityServiceSchema.optional(),
		services: AndroidActivityServiceSchema.optional(),
	})
	.optional();

/**
 * Main Tiapp schema
 */
export const TiappSchema = z
	.object({
		id: z.string().optional(),
		idPlatformAndroid: z.string().optional(),
		idPlatformIos: z.string().optional(),
		name: OptionalStringSchema,
		version: OptionalStringSchema,
		publisher: OptionalStringSchema,
		url: OptionalStringSchema,
		description: OptionalStringSchema,
		copyright: OptionalStringSchema,
		icon: OptionalStringSchema,
		fullscreen: BooleanSchema.optional(),
		navbarHidden: BooleanSchema.optional(),
		analytics: BooleanSchema.optional(),
		guid: OptionalStringSchema,
		persistentWifi: BooleanSchema.optional(),
		prerenderedIcon: BooleanSchema.optional(),
		statusbarStyle: OptionalStringSchema,
		statusbarHidden: BooleanSchema.optional(),
		sdkVersion: OptionalStringSchema,
		properties: PropertiesSchema,
		deploymentTargets: DeploymentTargetsSchema,
		modules: ModulesSchema,
		ios: IOSSchema,
		android: AndroidSchema,
	})
	.partial();

/**
 * Infer TypeScript types from schemas
 */
export type PropertyValue = z.infer<typeof PropertyValueSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type IOSConfig = z.infer<typeof IOSSchema>;
export type AndroidConfig = z.infer<typeof AndroidSchema>;
export type Tiapp = z.infer<typeof TiappSchema>;
