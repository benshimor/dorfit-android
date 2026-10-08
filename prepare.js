// Runs after `npx cap add android`: patches the generated Android project.
const fs = require('fs'), path = require('path');
const R = fs.existsSync(path.join(__dirname, 'dorfit-release.jks')) ? __dirname : path.join(__dirname, '..');
const A = path.join(R, 'android');
const ok = (m) => console.log('[prepare] ' + m);

// 1) minSdk 26 (required by Health Connect)
const vars = path.join(A, 'variables.gradle');
if (fs.existsSync(vars)) {
  let v = fs.readFileSync(vars, 'utf8');
  v = v.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
  fs.writeFileSync(vars, v); ok('minSdkVersion = 26');
}

// 2) release signing with the committed keystore
fs.copyFileSync(path.join(R, 'dorfit-release.jks'), path.join(A, 'app', 'dorfit-release.jks'));
const bg = path.join(A, 'app', 'build.gradle');
let g = fs.readFileSync(bg, 'utf8');
if (!g.includes('dorfit-release.jks')) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            storeFile file('dorfit-release.jks')
            storePassword 'dorfit2026'
            keyAlias 'dorfit'
            keyPassword 'dorfit2026'
        }
    }`);
  g = g.replace(/buildTypes\s*\{\s*release\s*\{/, `buildTypes {
        release {
            signingConfig signingConfigs.release`);
  fs.writeFileSync(bg, g); ok('signing configured');
}

// 3) launcher icons (replace adaptive/vector icons with the DOR FIT PNGs)
const res = path.join(A, 'app', 'src', 'main', 'res');
const IC = JSON.parse(fs.readFileSync(path.join(R, 'icons.json'), 'utf8'));
for (const d of Object.keys(IC)) {
  const dest = path.join(res, d);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']) fs.writeFileSync(path.join(dest, f), Buffer.from(IC[d], 'base64'));
}
for (const d of ['mipmap-anydpi-v26', 'drawable-v24']) fs.rmSync(path.join(res, d), { recursive: true, force: true });
// (the vector foreground lives in drawable-v24 / drawable; the anydpi xml referenced it)
ok('icons replaced');

// 4) Health Connect privacy-policy page is copied from www/ by `cap sync`
// 5) app label
const sx = path.join(res, 'values', 'strings.xml');
if (fs.existsSync(sx)) { let s = fs.readFileSync(sx, 'utf8'); s = s.replace(/(<string name="app_name">)[^<]*/, '$1DOR FIT').replace(/(<string name="title_activity_main">)[^<]*/, '$1DOR FIT'); fs.writeFileSync(sx, s); ok('app name'); }

// 6) dark splash instead of the default Capacitor image
const st = path.join(res, 'values', 'styles.xml');
if (fs.existsSync(st)) {
  let s = fs.readFileSync(st, 'utf8');
  s = s.replace(/<item name="android:background">@drawable\/splash<\/item>/, '<item name="android:background">#05070d</item>\n        <item name="windowSplashScreenBackground">#05070d</item>');
  // dark window + system bars so no white strip shows around the web view
  s = s.replace(/(<style name="AppTheme"[^>]*>)/, '$1\n        <item name="android:windowBackground">#05070d</item>\n        <item name="android:statusBarColor">#05070d</item>\n        <item name="android:navigationBarColor">#05070d</item>');
  fs.writeFileSync(st, s); ok('dark splash + dark system bars');
}
