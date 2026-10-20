# Add project specific ProGuard rules here.
-keepclassmembers class com.anvilmc.app.AnvilNativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.anvilmc.app.** { *; }
