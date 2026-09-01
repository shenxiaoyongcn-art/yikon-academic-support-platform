package com.yikon.pedigree;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String APP_START_URL = APP_ORIGIN + "/assets/index.html";
    private WebView webView;
    private boolean showingError;
    private String lastConsoleError = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.setWebViewClient(new LocalAssetWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d("YikonPedigree", message.message() + " @" + message.lineNumber());
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    lastConsoleError = message.message();
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
        webView.loadUrl(APP_START_URL);
    }

    private class LocalAssetWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return assetResponse(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return assetResponse(Uri.parse(url));
        }

        private WebResourceResponse assetResponse(Uri uri) {
            if (!"appassets.androidplatform.net".equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || !path.startsWith("/assets/")) return null;
            String assetPath = path.substring("/assets/".length());
            if (assetPath.contains("..")) return null;
            try {
                InputStream stream = getAssets().open(assetPath);
                return new WebResourceResponse(mimeType(assetPath), "UTF-8", stream);
            } catch (IOException error) {
                Log.e("YikonPedigree", "Missing local asset: " + assetPath, error);
                return null;
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (!APP_START_URL.equals(url) || showingError) return;
            view.postDelayed(() -> view.evaluateJavascript(
                "Boolean(document.querySelector('[data-app-ready=\"true\"]'))",
                result -> {
                    if (!"true".equals(result) && !showingError) {
                        String detail = lastConsoleError.isEmpty() ? "页面脚本未能启动" : lastConsoleError;
                        showLoadError(detail);
                    }
                }
            ), 6000);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) showLoadError(String.valueOf(error.getDescription()));
        }
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void showLoadError(String detail) {
        if (showingError) return;
        showingError = true;
        String safeDetail = detail == null ? "未知错误" : detail
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;");
        String html = "<!doctype html><html lang='zh-CN'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<body style='margin:0;padding:32px;background:#f6f3f5;color:#263147;font-family:sans-serif'>"
            + "<div style='max-width:560px;margin:18vh auto;padding:28px;background:white;border-radius:18px;box-shadow:0 10px 34px #35162a18'>"
            + "<h2 style='margin:0 0 12px;color:#94116f'>应用启动失败</h2>"
            + "<p style='line-height:1.7'>本地页面没有正常加载，请截图本页并反馈。</p>"
            + "<code style='display:block;padding:12px;border-radius:8px;background:#f4f5f7;word-break:break-all'>" + safeDetail + "</code>"
            + "<button onclick='AndroidBridge.reloadApp()' style='margin-top:18px;padding:10px 18px;border:0;border-radius:8px;background:#94116f;color:white'>重新加载</button>"
            + "</div></body></html>";
        webView.post(() -> webView.loadDataWithBaseURL(APP_ORIGIN, html, "text/html", "UTF-8", null));
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public static class AndroidBridge {
        private final Activity activity;

        AndroidBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void reloadApp() {
            activity.runOnUiThread(() -> {
                MainActivity mainActivity = (MainActivity) activity;
                mainActivity.showingError = false;
                mainActivity.lastConsoleError = "";
                mainActivity.webView.loadUrl(APP_START_URL);
            });
        }

        @JavascriptInterface
        public void saveBase64(String fileName, String base64Data, String mimeType) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/YikonPedigree");
                    Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("Unable to create download");
                    try (OutputStream stream = activity.getContentResolver().openOutputStream(uri)) {
                        if (stream == null) throw new IllegalStateException("Unable to open download");
                        stream.write(bytes);
                    }
                } else {
                    File directory = new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "YikonPedigree");
                    if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Unable to create directory");
                    try (FileOutputStream stream = new FileOutputStream(new File(directory, fileName))) {
                        stream.write(bytes);
                    }
                }
                activity.runOnUiThread(() -> Toast.makeText(activity, "已保存到下载/YikonPedigree", Toast.LENGTH_SHORT).show());
            } catch (Exception error) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "保存失败：" + error.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
