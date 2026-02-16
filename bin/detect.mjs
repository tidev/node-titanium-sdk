import { detectAndroidSDKs, detectAndroidNDKs } from '../dist/android/index.mjs';
import { detectJDKs } from '../dist/jdk.mjs';
import { detectTitaniumSDKs } from '../dist/titanium/index.mjs';

const type = process.argv[2];

if (!type || type === 'android-sdk') {
    console.log('== Android SDKs '.padEnd(80, '='));
    const androidSDKs = await detectAndroidSDKs();
    console.log(androidSDKs);
}

if (!type || type === 'android-ndk') {
    console.log('\n== Android NDKs '.padEnd(80, '='));
    const androidNDKs = await detectAndroidNDKs();
    console.log(androidNDKs);
}

if (!type || type === 'jdk') {
    console.log('\n== JDKs '.padEnd(80, '='));
    const jdk = await detectJDKs();
    console.log(jdk);
}

if (!type || type === 'titanium-sdk') {
    console.log('\n== Titanium SDKs '.padEnd(80, '='));
    const titaniumSDKs = await detectTitaniumSDKs();
    console.log(titaniumSDKs);
}
