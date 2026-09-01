#!/bin/sh
set -eu

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <android-sdk-root> <jdk-home> <node-binary> [output-apk]" >&2
  exit 1
fi

YIKON_ANDROID_SDK="$1"
YIKON_JDK_HOME="$2"
YIKON_NODE="$3"
YIKON_PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
YIKON_OUTPUT_APK="${4:-$YIKON_PROJECT_ROOT/outputs/YikonPedigree-v1.2.0.apk}"
YIKON_BUILD_TOOLS="$YIKON_ANDROID_SDK/build-tools/36.0.0"
YIKON_ANDROID_JAR="$YIKON_ANDROID_SDK/platforms/android-36/android.jar"
YIKON_BUILD_DIR=$(mktemp -d /private/tmp/yikon-apk-build.XXXXXX)
YIKON_KEYSTORE_DIR="$YIKON_PROJECT_ROOT/android-app/keystore"
YIKON_KEYSTORE="$YIKON_KEYSTORE_DIR/yikon-internal.keystore"

for required in "$YIKON_BUILD_TOOLS/aapt2" "$YIKON_BUILD_TOOLS/zipalign" "$YIKON_ANDROID_JAR" "$YIKON_JDK_HOME/bin/java" "$YIKON_NODE"; do
  if [ ! -e "$required" ]; then
    echo "Missing build dependency: $required" >&2
    exit 1
  fi
done

"$YIKON_NODE" "$YIKON_PROJECT_ROOT/node_modules/vite/bin/vite.js" build --config "$YIKON_PROJECT_ROOT/android-web/vite.config.ts"

mkdir -p "$YIKON_BUILD_DIR/generated" "$YIKON_BUILD_DIR/classes" "$YIKON_BUILD_DIR/dex" "$YIKON_KEYSTORE_DIR" "$(dirname "$YIKON_OUTPUT_APK")"

"$YIKON_BUILD_TOOLS/aapt2" compile \
  --dir "$YIKON_PROJECT_ROOT/android-app/app/src/main/res" \
  -o "$YIKON_BUILD_DIR/resources.zip"

"$YIKON_BUILD_TOOLS/aapt2" link \
  -o "$YIKON_BUILD_DIR/unsigned.apk" \
  -I "$YIKON_ANDROID_JAR" \
  --manifest "$YIKON_PROJECT_ROOT/android-app/app/src/main/AndroidManifest.xml" \
  --min-sdk-version 26 \
  --target-sdk-version 36 \
  --version-code 4 \
  --version-name 1.2.0 \
  --auto-add-overlay \
  --java "$YIKON_BUILD_DIR/generated" \
  -A "$YIKON_PROJECT_ROOT/android-app/app/src/main/assets" \
  -R "$YIKON_BUILD_DIR/resources.zip"

"$YIKON_JDK_HOME/bin/javac" \
  --release 8 \
  -cp "$YIKON_ANDROID_JAR" \
  -d "$YIKON_BUILD_DIR/classes" \
  "$YIKON_PROJECT_ROOT/android-app/app/src/main/java/com/yikon/pedigree/MainActivity.java" \
  "$YIKON_BUILD_DIR/generated/com/yikon/pedigree/R.java"

"$YIKON_JDK_HOME/bin/jar" cf "$YIKON_BUILD_DIR/classes.jar" -C "$YIKON_BUILD_DIR/classes" .
"$YIKON_JDK_HOME/bin/java" -cp "$YIKON_BUILD_TOOLS/lib/d8.jar" com.android.tools.r8.D8 \
  --lib "$YIKON_ANDROID_JAR" \
  --min-api 26 \
  --output "$YIKON_BUILD_DIR/dex" \
  "$YIKON_BUILD_DIR/classes.jar"

/usr/bin/zip -q -j "$YIKON_BUILD_DIR/unsigned.apk" "$YIKON_BUILD_DIR/dex/classes.dex"
"$YIKON_BUILD_TOOLS/zipalign" -f -p 4 "$YIKON_BUILD_DIR/unsigned.apk" "$YIKON_BUILD_DIR/aligned.apk"

if [ ! -f "$YIKON_KEYSTORE" ]; then
  "$YIKON_JDK_HOME/bin/keytool" -genkeypair \
    -keystore "$YIKON_KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias yikon-internal \
    -dname "CN=Yikon Pedigree Internal, OU=Academic Support, O=Yikon, C=CN" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
fi

"$YIKON_JDK_HOME/bin/java" -jar "$YIKON_BUILD_TOOLS/lib/apksigner.jar" sign \
  --ks "$YIKON_KEYSTORE" \
  --ks-key-alias yikon-internal \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$YIKON_OUTPUT_APK" \
  "$YIKON_BUILD_DIR/aligned.apk"

"$YIKON_JDK_HOME/bin/java" -jar "$YIKON_BUILD_TOOLS/lib/apksigner.jar" verify --verbose --print-certs "$YIKON_OUTPUT_APK"
echo "APK: $YIKON_OUTPUT_APK"
