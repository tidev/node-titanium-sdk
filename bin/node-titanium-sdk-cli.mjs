import { detectAndroidSDKs, detectAndroidNDKs } from '../dist/android/index.mjs';
import { detectJDKs } from '../dist/jdk.mjs';
import { detectTitaniumSDKs } from '../dist/titanium/index.mjs';

// console.log('== Android SDKs '.padEnd(80, '='));
// const androidSDKs = await detectAndroidSDKs();
// console.log(androidSDKs);

console.log('\n== Android NDKs '.padEnd(80, '='));
const androidNDKs = await detectAndroidNDKs();
console.log(androidNDKs);

// console.log('\n== JDKs '.padEnd(80, '='));
// const jdk = await detectJDKs();
// console.log(jdk);

// console.log('\n== Titanium SDKs '.padEnd(80, '='));
// const titaniumSDKs = await detectTitaniumSDKs();
// console.log(titaniumSDKs);
