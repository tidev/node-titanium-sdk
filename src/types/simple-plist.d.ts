declare module 'simple-plist' {
	type PlistJsObj = Record<any, any> | any[];
	type StringOrBuffer = string | Buffer;

	interface SimplePlist {
		stringify(anObject: PlistJsObj): string;
		parse<T = PlistJsObj>(aStringOrBuffer: StringOrBuffer): T;
	}

	const plist: SimplePlist;
	export = plist;
}
