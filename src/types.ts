import type { AgentOptions } from 'node:http';

export type ConfigSearchPaths =
	| string[]
	| {
			darwin?: string[];
			linux?: string[];
			win32?: string[];
	  };

export interface Config {
	android: {
		adb: {
			install: {
				timeout: number | null;
			};
			path: string | null;
			port: number | null;
			start: {
				retryInterval: number | null;
				timeout: number | null;
			};
		};
		avd: {
			path: string;
		};
		emulator: {
			start: {
				timeout: number | null;
			};
		};
		ndk: {
			searchPaths: ConfigSearchPaths;
		};
		sdk: {
			searchPaths: ConfigSearchPaths;
		};
	};

	env: {
		path: string | null;
	};

	ios: {
		executables: {
			security: string | null;
			sqlite: string | null;
			xcodeSelect: string | null;
		};
		keychainMetaFile: string;
		provisioning: {
			searchPaths: ConfigSearchPaths;
		};
		simulator: {
			crashLogsDir: string;
			devicesDir: string;
			runtimesDir: string;
		};
		xcode: {
			searchPaths: ConfigSearchPaths;
		};
	};

	jdk: {
		javaHome: string | null;
		searchPaths: ConfigSearchPaths;
		windows: {
			registryKeys: string[];
		};
	};

	network: {
		agentOptions: AgentOptions | null;
		caFile: string | null;
		certFile: string | null;
		httpProxy: string | null;
		httpsProxy: string | null;
		keyFile: string | null;
		passphrase: string | null;
		strictSSL: boolean;
	};

	titanium: {
		modules: {
			searchPaths: ConfigSearchPaths;
		};
		sdk: {
			downloadURLs: {
				branches: string;
				branchBuilds: string;
				releases: {
					beta: string;
					rc: string;
					ga: string;
				};
			};
			installPath: {
				darwin: string;
				linux: string;
				win32: string;
			};
			searchPaths: ConfigSearchPaths;
		};
	};
}

export interface ErrorWithCode extends Error {
	code: string;
}
