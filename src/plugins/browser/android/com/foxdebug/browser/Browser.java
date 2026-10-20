package com.foxdebug.browser;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.text.InputType;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import com.foxdebug.browser.Emulator;
import com.foxdebug.browser.Menu;
import com.foxdebug.system.Ui;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import android.os.Handler;
import android.os.Looper;




public class Browser extends LinearLayout {

  public int FILE_SELECT_CODE = 1;

  public Menu menu;
  public WebView webView;
  private Ui.Theme theme;
  public Context context;
  private TextView urlText;
  private LinearLayout main;
  private ImageView favicon;
  private TextView titleText;
  private ProgressBar loading;
  private Emulator deviceEmulator;

  public boolean emulator = false;
  public boolean console = false;
  public boolean desktopMode = false;
  // Virtual cursor overlay. Intentionally NOT persisted: it is off every
  // time the browser is launched.
  public boolean cursor = false;
  // How far the cursor moves per unit of finger movement (trackpad speed).
  // Tap "Cursor Speed" in the menu to cycle through CURSOR_SPEEDS.
  public float cursorSpeed = 1.5f;
  private static final float[] CURSOR_SPEEDS = { 0.5f, 1f, 1.5f, 2f, 3f, 4f };

  private String url = "";
  private String title = "Browser";

  private int padding;
  private int fontSize;
  private int imageSize;
  private int titleHeight;
  private int titleTextHeight;
  private boolean onlyConsole;

  ValueCallback<Uri[]> filePathCallback;
  final int REQUEST_SELECT_FILE = 1;

  public Browser(Context context, Ui.Theme theme, Boolean onlyConsole) {
    super(context);
    this.theme = theme;
    this.context = context;
    this.onlyConsole = onlyConsole;
    this.padding = Ui.dpToPixels(context, 5);
    this.fontSize = Ui.dpToPixels(context, 5);
    this.imageSize = Ui.dpToPixels(context, 35);
    this.titleHeight = Ui.dpToPixels(context, 45);
    this.titleTextHeight = Ui.dpToPixels(context, 35);

    this.init();
  }

  public void init() {
    WebSettings settings;
    ImageButton menuIcon;
    ImageButton refreshIcon;
    LinearLayout titleLayout;
    FrameLayout faviconFrame;
    LinearLayout webViewContainer;
    LinearLayout.LayoutParams faviconFrameParams;

    favicon = createIcon(Ui.Icons.LOGO);
    menuIcon = createIconButton(Ui.Icons.MORE_VERT);
    menuIcon.setOnClickListener(
      new View.OnClickListener() {
        @Override
        public void onClick(View view) {
          menu.show(view);
        }
      }
    );

    refreshIcon = createIconButton(Ui.Icons.REFRESH);
    refreshIcon.setOnClickListener(
      new View.OnClickListener() {
        @Override
        public void onClick(View v) {
          webView.reload();
        }
      }
    );

    loading = new ProgressBar(context, null, android.R.attr.progressBarStyle);
    loading.setLayoutParams(
      new LinearLayout.LayoutParams(this.imageSize, this.imageSize, 0)
    );

    faviconFrame = new FrameLayout(context);
    faviconFrameParams = new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.WRAP_CONTENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    );
    faviconFrameParams.gravity = Gravity.CENTER_VERTICAL;
    faviconFrame.setLayoutParams(faviconFrameParams);
    faviconFrame.addView(favicon);
    faviconFrame.addView(loading);

    titleLayout = createTile();
    titleLayout.addView(faviconFrame);
    titleText = onlyConsole ? createTextView(title) : createEditText(title);
    titleLayout.addView(titleText);
    if (!onlyConsole) {
      titleLayout.addView(refreshIcon);
      titleLayout.addView(menuIcon);
    }

    webView = new WebView(context);
    webView.setFocusable(true);
    webView.setFocusableInTouchMode(true);
    webView.setBackgroundColor(0xFFFFFFFF);


    webView.setDownloadListener(new DownloadListener() {
        @Override
        public void onDownloadStart(String url, String userAgent,
                                    String contentDisposition, String mimeType,
                                    long contentLength) {

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);

            new Handler(Looper.getMainLooper()).post(() -> {

              new AlertDialog.Builder(getContext())
                .setTitle("Download file")
                .setMessage("Do you want to download \"" + fileName + "\"?")
                .setPositiveButton("Yes", (dialog, which) -> {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("Downloading file...");
                    request.setTitle(fileName);
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                    DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(request);

                    Toast.makeText(getContext(), "Download started...", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Cancel", null)
                .show();


            });
            
        }
    });


    fitWebViewTo(0, 0, 1);

    webView.setWebChromeClient(new BrowserChromeClient(this));
    webView.setWebViewClient(new BrowserWebViewClient(this));

    settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowContentAccess(true);
    settings.setDisplayZoomControls(false);
    settings.setDomStorageEnabled(true);

    webViewContainer = new LinearLayout(context);
    webViewContainer.setGravity(Gravity.CENTER);
    webViewContainer.setLayoutParams(
      new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
        1
      )
    );
    webViewContainer.setBackgroundColor(theme.get("primaryColor"));
    webViewContainer.addView(webView);

    setOrientation(LinearLayout.VERTICAL);
    setFocusableInTouchMode(true);
    setFocusable(true);
    createMenu();
    addView(titleLayout);
    addView(webViewContainer);
    restoreEmulator();
  }

  private void createMenu() {
    Browser browser = this;
    menu = new Menu(context, theme);

    menu.addItem(Ui.Icons.DEVICES, "Devices", false);
    menu.addItem(Ui.Icons.NO_CACHE, "Disable Cache", false);
    menu.addItem(Ui.Icons.TERMINAL, "Console", false);
    menu.addItem(Ui.Icons.CURSOR, "Cursor", false);
    menu.addItem(Ui.Icons.TUNE, "Cursor Speed");
    menu.setVisible("Cursor Speed", false);
    menu.setLabel("Cursor Speed", cursorSpeedLabel());
    menu.addItem(Ui.Icons.TUNE, "Set as Default");
    menu.addItem(Ui.Icons.REFRESH, "Clear Default");
    menu.setVisible("Set as Default", false);
    menu.setVisible("Clear Default", false);
    menu.addItem(Ui.Icons.OPEN_IN_BROWSER, "Open in Browser");
    menu.addItem(Ui.Icons.EXIT, "Exit");

    menu.setCallback(
      new Menu.Callback() {
        @Override
        public void onSelect(String action, Boolean checked) {
          switch (action) {
            case "Devices":
              if (deviceEmulator == null) {
                createDeviceEmulatorLayout();
              }

              emulator = checked;
              updateDefaultItems(checked);
              if (checked) {
                setDesktopMode(true);
                setConsoleVisible(false);
                menu.setChecked("Console", false);
                menu.setVisible("Console", false);
                addView(deviceEmulator);
                fitWebViewTo(
                  deviceEmulator.getWidthProgress(),
                  deviceEmulator.getHeightProgress(),
                  deviceEmulator.getScaleProgress()
                );
              } else {
                menu.setVisible("Console", true);
                removeView(deviceEmulator);
                fitWebViewTo(0, 0, 1);
                webView
                  .getViewTreeObserver()
                  .addOnGlobalLayoutListener(
                    new ViewTreeObserver.OnGlobalLayoutListener() {
                      @Override
                      public void onGlobalLayout() {
                        webView
                          .getViewTreeObserver()
                          .removeOnGlobalLayoutListener(this);
                        setDesktopMode(false);
                      }
                    }
                  );
              }

              break;
            case "Console":
              setConsoleVisible(checked);
              break;
            case "Cursor":
              cursor = checked;
              menu.setVisible("Cursor Speed", checked);
              applyCursor();
              break;
            case "Cursor Speed":
              cycleCursorSpeed();
              break;
            case "Set as Default":
              if (deviceEmulator != null) {
                deviceEmulator.saveAsDefault();
                updateDefaultItems(emulator);
                Toast
                  .makeText(
                    context,
                    "Saved as default preview",
                    Toast.LENGTH_SHORT
                  )
                  .show();
              }
              break;
            case "Clear Default":
              Emulator.clearDefault(context);
              updateDefaultItems(emulator);
              Toast
                .makeText(context, "Default cleared", Toast.LENGTH_SHORT)
                .show();
              break;
            case "Disable Cache":
              webView
                .getSettings()
                .setCacheMode(
                  checked ? WebSettings.LOAD_NO_CACHE : WebSettings.LOAD_DEFAULT
                );
              break;
            case "Open in Browser":
              Intent browserIntent = new Intent(
                Intent.ACTION_VIEW,
                Uri.parse(url)
              );
              context.startActivity(browserIntent);
              exit();
              break;
            case "Exit":
              exit();
              break;
          }
        }
      }
    );
  }

  private String cursorSpeedLabel() {
    return "Cursor Speed: " + cursorSpeed + "x";
  }

  /** Moves to the next speed in CURSOR_SPEEDS (wrapping) and applies it. */
  private void cycleCursorSpeed() {
    int index = 0;
    for (int i = 0; i < CURSOR_SPEEDS.length; i++) {
      if (CURSOR_SPEEDS[i] == cursorSpeed) {
        index = i;
        break;
      }
    }

    cursorSpeed = CURSOR_SPEEDS[(index + 1) % CURSOR_SPEEDS.length];
    menu.setLabel("Cursor Speed", cursorSpeedLabel());
    Toast
      .makeText(context, "Cursor speed: " + cursorSpeed + "x", Toast.LENGTH_SHORT)
      .show();
    applyCursor();
  }

  /**
   * Shows or hides a virtual cursor (arrow) inside the page, driven like a
   * trackpad. Safe to call repeatedly; any previous cursor is removed first
   * (its position is kept). Called when the menu toggle or speed changes and
   * after every page load, because navigating wipes the injected overlay.
   */
  public void applyCursor() {
    // The injected script lives in CursorScript (bottom of this file).
    webView.evaluateJavascript(CursorScript.build(cursor, cursorSpeed), null);
  }

  private void updateDefaultItems(boolean emulatorOn) {
    menu.setVisible("Set as Default", emulatorOn);
    menu.setVisible(
      "Clear Default",
      emulatorOn && Emulator.hasDefault(context)
    );
  }

  private void reloadAfterLayout() {
    // If no page was requested yet, the first load will already happen at
    // the saved size, so there is nothing to reload.
    if (url.isEmpty()) return;

    webView
      .getViewTreeObserver()
      .addOnGlobalLayoutListener(
        new ViewTreeObserver.OnGlobalLayoutListener() {
          @Override
          public void onGlobalLayout() {
            webView.getViewTreeObserver().removeOnGlobalLayoutListener(this);
            webView.reload();
          }
        }
      );
  }

  private void restoreEmulator() {
    if (onlyConsole) return;
    if (!Emulator.hasDefault(context)) return;

    // Apply the saved mode before the first navigation so the page is not
    // loaded with the wrong user agent and then reloaded.
    setDesktopMode(true, false);

    webView
      .getViewTreeObserver()
      .addOnGlobalLayoutListener(
        new ViewTreeObserver.OnGlobalLayoutListener() {
          @Override
          public void onGlobalLayout() {
            if (webView.getMeasuredWidth() == 0) return;
            webView.getViewTreeObserver().removeOnGlobalLayoutListener(this);

            if (deviceEmulator == null) {
              createDeviceEmulatorLayout();
              deviceEmulator.setRestoredListener(
                new Runnable() {
                  @Override
                  public void run() {
                    reloadAfterLayout();
                  }
                }
              );
            }

            emulator = true;
            menu.setChecked("Devices", true);
            updateDefaultItems(true);
            setConsoleVisible(false);
            menu.setChecked("Console", false);
            menu.setVisible("Console", false);
            addView(deviceEmulator);
            // The emulator sets up its sliders on a later layout pass and then
            // applies the saved size itself, so the webview is not resized here.
          }
        }
      );
  }

  private void createDeviceEmulatorLayout() {
    Browser browser = this;
    deviceEmulator = new Emulator(context, theme);
    deviceEmulator.setReference(webView);
    deviceEmulator.setChangeListener(
      new Emulator.Callback() {
        @Override
        public void onChange(int width, int height, float scale) {
          fitWebViewTo(width, height, scale);
        }
      }
    );
  }

  private void setTextViewProperties(TextView textView, int height) {
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.FILL_PARENT,
      height,
      1
    );
    params.gravity = Gravity.CENTER_VERTICAL;
    textView.setMaxLines(1);
    textView.setEllipsize(TextUtils.TruncateAt.END);
    textView.setSingleLine(true);
    textView.setHorizontallyScrolling(true);
    textView.setTextColor(theme.get("primaryTextColor"));
    textView.setLayoutParams(params);
    textView.setGravity(Gravity.CENTER_VERTICAL);
  }

  private void setDesktopMode(boolean enabled) {
    setDesktopMode(enabled, true);
  }

  private void setDesktopMode(boolean enabled, boolean reload) {
    int width = 0;
    int height = 0;
    WebSettings webSettings = webView.getSettings();

    desktopMode = enabled;
    webSettings.setUserAgentString(
      enabled
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
        : null
    );

    if (enabled) {
      width = webView.getMeasuredWidth();
      height = webView.getMeasuredHeight();
    }

    webSettings.setLoadWithOverviewMode(enabled);
    webSettings.setUseWideViewPort(enabled);
    webSettings.setLoadWithOverviewMode(enabled);
    webSettings.setSupportZoom(enabled);
    webSettings.setBuiltInZoomControls(enabled);
    if (reload) {
      webView.reload();
    }
  }

  public void setDesktopMode() {
    if (desktopMode) {
      int width = webView.getMeasuredWidth();
      int height = webView.getMeasuredHeight();
      updateViewportDimension(width, height);
    }
  }

  public void setUrl(String url) {
    this.url = url;
    setTitle(url);
    setProgressBarVisible(true);
    webView.loadUrl(url);
  }

  public void setTitle(String title) {
    this.title = title;
    titleText.setText(title);
  }

  public void setFavicon(Bitmap icon) {
    favicon.setImageBitmap(icon);
  }

  public void setConsoleVisible(boolean visible) {
    console = visible;
    String javascript = "document.dispatchEvent(new CustomEvent('%sconsole'))";
    javascript = String.format(javascript, visible ? "show" : "hide");
    webView.evaluateJavascript(javascript, null);
  }

  public void setProgressBarVisible(boolean visible) {
    loading.setVisibility(visible ? View.VISIBLE : View.GONE);
  }

  private void updateViewportDimension(int width, int height) {
    String script =
      "!function(){var e=document.head;if(e){e.querySelectorAll(\"meta[name=viewport]\").forEach(function(e){e.remove()});var t=document.createElement(\"meta\");t.name=\"viewport\",t.content=\"width=%s, height=%s, initial-scale=%s\",e.append(t)}}();";
    String w = "device-width";
    String h = "device-height";
    String r = "1";
    if (width > 0) {
      w = String.valueOf(width);
      r = "0.1";
      h = "";
    }

    if (height > 0) {
      h = String.valueOf(height);
    }

    webView.evaluateJavascript(String.format(script, w, h, r), null);
  }

  private void fitWebViewTo(int width, int height, float scale) {
    webView.setScaleX(scale);
    webView.setScaleY(scale);
    webView.setLayoutParams(
      new LinearLayout.LayoutParams(
        width == 0 ? ViewGroup.LayoutParams.MATCH_PARENT : width,
        height == 0 ? ViewGroup.LayoutParams.MATCH_PARENT : height
      )
    );
    if (width > 0 && height > 0) {
      updateViewportDimension(width, height);
    }
  }

  private void styleIcon(ImageView view) {
    int padding = Ui.dpToPixels(context, 7);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
      imageSize,
      imageSize
    );

    params.gravity = Gravity.CENTER_VERTICAL;
    view.setBackgroundDrawable(null);
    view.setLayoutParams(params);
    view.setScaleType(ImageView.ScaleType.FIT_CENTER);
    view.setAdjustViewBounds(true);
    view.setPadding(padding, padding, padding, padding);
  }

  private void keyboardVisible(boolean visible) {
    if (visible) {
      InputMethodManager imm = (InputMethodManager) context.getSystemService(
        Context.INPUT_METHOD_SERVICE
      );
      imm.toggleSoftInput(InputMethodManager.SHOW_FORCED, 0);
    } else {
      InputMethodManager imm = (InputMethodManager) context.getSystemService(
        Context.INPUT_METHOD_SERVICE
      );
      imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
    }
  }

  public boolean goBack() {
    if (console) {
      menu.setChecked("Console", false);
      setConsoleVisible(false);
      return true;
    }

    if (webView.canGoBack()) {
      webView.goBack();
      url = webView.getOriginalUrl();
      return true;
    }

    return false;
  }

  private TextView createTextView(String text) {
    TextView textView = new TextView(context);
    setTextViewProperties(textView, this.titleHeight);
    textView.setText(text);
    return textView;
  }

  private EditText createEditText(String text) {
    EditText editText = new EditText(context);
    GradientDrawable background = new GradientDrawable();
    String themeType = theme.getType();

    int radius = this.titleTextHeight / 2;
    background.setCornerRadius(radius);
    background.setColor(themeType.equals("light") ? 0x11000000 : 0x11ffffff);
    editText.setBackground(background);

    setTextViewProperties(editText, this.titleTextHeight);
    editText.setText(text);
    editText.setPadding(radius, 0, radius, 0);
    editText.setTextSize(this.fontSize < 10 ? 10 : this.fontSize);
    editText.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
    editText.setImeOptions(EditorInfo.IME_ACTION_GO);

    editText.setOnFocusChangeListener(
      new View.OnFocusChangeListener() {
        @Override
        public void onFocusChange(View v, boolean hasFocus) {
          if (hasFocus) {
            titleText.setText(url);
            keyboardVisible(true);
          } else {
            titleText.setText(title);
            keyboardVisible(false);
          }
        }
      }
    );

    editText.setOnEditorActionListener(
      new EditText.OnEditorActionListener() {
        @Override
        public boolean onEditorAction(
          TextView v,
          int actionId,
          KeyEvent event
        ) {
          if (actionId == EditorInfo.IME_ACTION_GO) {
            String url = v.getText().toString();
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              url = "http://" + url;
            }

            title = url;
            setUrl(url);
            editText.clearFocus();
            keyboardVisible(false);
            return true;
          }
          return false;
        }
      }
    );

    return editText;
  }

  private LinearLayout createTile() {
    return createTile(titleHeight);
  }

  private LinearLayout createTile(int height) {
    LinearLayout tile = new LinearLayout(context);
    tile.setOrientation(LinearLayout.HORIZONTAL);
    tile.setBackgroundColor(theme.get("primaryColor"));
    tile.setLayoutParams(
      new LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, height)
    );
    tile.setHorizontalGravity(Gravity.LEFT);
    tile.setVerticalGravity(Gravity.TOP);
    return tile;
  }

  private ImageButton createIconButton(String icon) {
    Bitmap bitmap = Ui.Icons.get(context, icon, theme.get("primaryTextColor"));
    ImageButton button = createIconButton(bitmap);
    return button;
  }

  private ImageButton createIconButton(Bitmap icon) {
    ImageButton button = new ImageButton(context);
    button.setImageBitmap(icon);
    styleIcon(button);
    return button;
  }

  private ImageView createIcon(String code) {
    Bitmap bitmap = Ui.Icons.get(context, code, theme.get("primaryTextColor"));
    ImageView icon = new ImageView(context);
    icon.setImageBitmap(bitmap);
    styleIcon(icon);
    return icon;
  }

  public void exit() {
    if (console) {
      setConsoleVisible(false);
      return;
    }

    if (webView.canGoBack()) {
      webView.goBack();
      return;
    }

    webView.destroy();
    ((Activity) context).finish();
  }
}

/**
 * JavaScript injected into the page while the "Cursor" menu toggle is on.
 *
 * Behaviour:
 *  - A virtual mouse cursor (the Acode arrow) is drawn over the page. Its
 *    shape follows the CSS `cursor` of whatever is under it (pointer hand,
 *    text I-beam, grab, not-allowed, resize arrows, ...).
 *  - Dragging a finger moves the cursor like a trackpad, multiplied by SPEED.
 *  - A quick tap clicks at the cursor.
 *  - Hover is emulated: mouseover/mouseenter/mousemove events are fired and
 *    :hover rules from same-origin stylesheets are mirrored onto a helper
 *    class, so hover effects and hover-dependent cursors work.
 *  - Normal one-finger touch, scrolling and taps on the page are blocked, but
 *    two-finger pinch zoom is still allowed.
 */
class CursorScript {

  static String build(boolean on, float speed) {
    String[] js = {
      "(function(on,SPEED){",
      "if(window.__acodeCursorCleanup){window.__acodeCursorCleanup();window.__acodeCursorCleanup=null;}",
      "if(!on)return;",
      "var root=document.documentElement;if(!root)return;",
      "var NS='http://www.w3.org/2000/svg';",
      "var HV='__acode_hv';",
      "var cur='',hot=[0,0],hv=null,gesture=false;",
      "var t0=0,sx=0,sy=0,lx=0,ly=0,moved=false,active=false;",
      // visible area, so the cursor also behaves while pinch-zoomed
      "function bounds(){var v=window.visualViewport;",
      "if(v)return{x0:v.offsetLeft,y0:v.offsetTop,x1:v.offsetLeft+v.width,y1:v.offsetTop+v.height,s:v.scale||1};",
      "return{x0:0,y0:0,x1:window.innerWidth,y1:window.innerHeight,s:1};}",
      // copy every :hover rule to a helper class we can toggle ourselves
      "function rulesToCss(rules){var out='';",
      "for(var i=0;i<rules.length;i++){var r=rules[i];",
      "try{",
      "if(r.type===1){if(r.selectorText&&r.selectorText.indexOf(':hover')>-1){",
      "out+=r.selectorText.replace(/:hover/g,'.'+HV)+'{'+r.style.cssText+'}';}}",
      "else if(r.cssRules&&(r.type===4||r.type===12)){",
      "var inner=rulesToCss(r.cssRules);",
      "if(inner){out+=(r.type===4?'@media '+r.media.mediaText:'@supports '+r.conditionText)+'{'+inner+'}';}}",
      "}catch(err){}}",
      "return out;}",
      "function hoverCss(){var css='';",
      "for(var i=0;i<document.styleSheets.length;i++){",
      "try{css+=rulesToCss(document.styleSheets[i].cssRules);}catch(err){}}",
      "return css;}",
      // block panning / text selection but keep pinch zoom
      "var st=document.createElement('style');",
      "st.textContent='html,body,*{touch-action:pinch-zoom!important;-webkit-user-select:none!important;user-select:none!important;}'+hoverCss();",
      "(document.head||root).appendChild(st);",
      "var c=document.createElement('div');",
      "c.style.cssText='position:fixed;left:0;top:0;width:24px;height:24px;pointer-events:none;z-index:2147483647;transform-origin:0 0;will-change:transform;';",
      "root.appendChild(c);",
      // cursor shapes: [tag, attrs, filled, strokeWidth, text]; drawn black with a white outline
      "var EW=[['rect',{x:5,y:11,width:14,height:2},1],['path',{d:'M1.5 12L7 7.5V16.5Z'},1],['path',{d:'M22.5 12L17 7.5V16.5Z'},1]];",
      "var SHAPES={",
      "arrow:{hx:0,hy:0,o:48,g:'scale(0.0505) translate(-88 -50)',items:[['path',{d:'M88 50L445 385L240 395L88 525Z'},1,30]]},",
      "hand:{hx:9.7,hy:2,o:2.4,items:[['rect',{x:8,y:2,width:3.4,height:12,rx:1.7},1],['rect',{x:11.4,y:8,width:3,height:9,rx:1.5},1],['rect',{x:14.4,y:9,width:3,height:8,rx:1.5},1],['rect',{x:17.4,y:10,width:2.8,height:7,rx:1.4},1],['rect',{x:5.5,y:12,width:14.7,height:9.5,rx:4.5},1],['rect',{x:3.2,y:12.5,width:6,height:3.4,rx:1.7,transform:'rotate(35 5 14)'},1]]},",
      "text:{hx:12,hy:12,o:2.4,items:[['rect',{x:11,y:3,width:2,height:18},1],['rect',{x:8,y:3,width:8,height:2},1],['rect',{x:8,y:19,width:8,height:2},1]]},",
      "cross:{hx:12,hy:12,o:2.4,items:[['rect',{x:11,y:2,width:2,height:20},1],['rect',{x:2,y:11,width:20,height:2},1]]},",
      "wait:{hx:12,hy:12,o:2.4,items:[['circle',{cx:12,cy:12,r:7,'stroke-dasharray':'28 16'},0,3]]},",
      "no:{hx:12,hy:12,o:2.4,items:[['circle',{cx:12,cy:12,r:8},0,3],['line',{x1:6.3,y1:6.3,x2:17.7,y2:17.7},0,3]]},",
      "move:{hx:12,hy:12,o:2.4,items:[['rect',{x:11,y:4,width:2,height:16},1],['rect',{x:4,y:11,width:16,height:2},1],['path',{d:'M12 1L16 6H8Z'},1],['path',{d:'M12 23L16 18H8Z'},1],['path',{d:'M1 12L6 8V16Z'},1],['path',{d:'M23 12L18 8V16Z'},1]]},",
      "ew:{hx:12,hy:12,o:2.4,items:EW},",
      "ns:{hx:12,hy:12,o:2.4,g:'rotate(90 12 12)',items:EW},",
      "nesw:{hx:12,hy:12,o:2.4,g:'rotate(-45 12 12)',items:EW},",
      "nwse:{hx:12,hy:12,o:2.4,g:'rotate(45 12 12)',items:EW},",
      "grab:{hx:12,hy:12,o:2.4,items:[['rect',{x:5,y:10,width:14,height:10,rx:4},1],['rect',{x:5.8,y:5,width:3,height:8,rx:1.5},1],['rect',{x:9.1,y:4,width:3,height:9,rx:1.5},1],['rect',{x:12.4,y:4,width:3,height:9,rx:1.5},1],['rect',{x:15.7,y:5,width:3,height:8,rx:1.5},1]]},",
      "grabbing:{hx:12,hy:12,o:2.4,items:[['rect',{x:5,y:10,width:14,height:10,rx:4},1],['rect',{x:5.8,y:8,width:3,height:5,rx:1.5},1],['rect',{x:9.1,y:7,width:3,height:6,rx:1.5},1],['rect',{x:12.4,y:7,width:3,height:6,rx:1.5},1],['rect',{x:15.7,y:8,width:3,height:5,rx:1.5},1]]},",
      "help:{hx:12,hy:12,o:2.4,items:[['text',{x:12,y:20,'font-size':22,'font-weight':'700','text-anchor':'middle','font-family':'Arial,sans-serif'},1,0,'?']]}",
      "};",
      // CSS cursor value -> shape
      "var MAP={pointer:'hand',grab:'grab',grabbing:'grabbing',text:'text','vertical-text':'text',crosshair:'cross',cell:'cross',wait:'wait',progress:'wait','not-allowed':'no','no-drop':'no',move:'move','all-scroll':'move',help:'help','ew-resize':'ew','col-resize':'ew','e-resize':'ew','w-resize':'ew','ns-resize':'ns','row-resize':'ns','n-resize':'ns','s-resize':'ns','nesw-resize':'nesw','ne-resize':'nesw','sw-resize':'nesw','nwse-resize':'nwse','nw-resize':'nwse','se-resize':'nwse'};",
      "function mk(tag,attrs){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);return e;}",
      "function build(shape){",
      "var svg=mk('svg',{width:24,height:24,viewBox:'0 0 24 24'});",
      "svg.style.cssText='position:absolute;left:0;top:0;overflow:visible;';",
      "var g=mk('g',shape.g?{transform:shape.g}:{});svg.appendChild(g);",
      "for(var pass=0;pass<2;pass++){",
      "for(var i=0;i<shape.items.length;i++){",
      "var it=shape.items[i];var e=mk(it[0],it[1]);var sw=it[3]||0;",
      "var col=pass===0?'#fff':'#000';",
      "e.setAttribute('fill',it[2]?col:'none');",
      "if(pass===0){e.setAttribute('stroke','#fff');e.setAttribute('stroke-width',sw+shape.o);}",
      "else if(sw){e.setAttribute('stroke','#000');e.setAttribute('stroke-width',sw);}",
      "e.setAttribute('stroke-linejoin','round');e.setAttribute('stroke-linecap','round');",
      "if(it[4])e.textContent=it[4];",
      "g.appendChild(e);}}",
      "return svg;}",
      // position
      "var pos=window.__acodeCursorPos;var b0=bounds();",
      "var cx=pos?pos[0]:(b0.x0+b0.x1)/2,cy=pos?pos[1]:(b0.y0+b0.y1)/2;",
      "function draw(){var b=bounds();window.__acodeCursorPos=[cx,cy];",
      "c.style.transform='translate('+(cx-hot[0]/b.s)+'px,'+(cy-hot[1]/b.s)+'px) scale('+(1/b.s)+')';}",
      "function nudge(dx,dy){var b=bounds();",
      "cx=Math.max(b.x0,Math.min(b.x1-1,cx+dx));",
      "cy=Math.max(b.y0,Math.min(b.y1-1,cy+dy));draw();}",
      "function setShape(k){if(k===cur)return;cur=k;",
      "while(c.firstChild)c.removeChild(c.firstChild);",
      "if(k==='none'){c.style.visibility='hidden';return;}",
      "c.style.visibility='visible';",
      "var s=SHAPES[k]||SHAPES.arrow;hot=[s.hx,s.hy];c.appendChild(build(s));draw();}",
      // which shape does the page want here?
      "function isText(el){var n=el.nodeName;if(n==='TEXTAREA')return true;",
      "if(n==='INPUT'){var t=(el.type||'text').toLowerCase();",
      "return ['button','submit','reset','checkbox','radio','range','color','file','image'].indexOf(t)<0;}",
      "return !!el.isContentEditable;}",
      "function kindOf(el){if(!el)return 'arrow';var v='auto';",
      "try{v=getComputedStyle(el).cursor||'auto';}catch(err){}",
      "var m=v.match(/([a-z-]+)\\s*$/);v=m?m[1]:'auto';",
      "if(v==='none')return 'none';",
      "if(v==='auto')return isText(el)?'text':'arrow';",
      "return MAP[v]||'arrow';}",
      // synthetic mouse events
      "function fire(el,type,bub){",
      "var o={bubbles:!!bub,cancelable:true,view:window,clientX:cx,clientY:cy,button:0,",
      "buttons:(type==='mousedown'||type==='pointerdown')?1:0};",
      "try{if(type.indexOf('pointer')===0&&window.PointerEvent){o.pointerType='mouse';o.isPrimary=true;el.dispatchEvent(new PointerEvent(type,o));}",
      "else el.dispatchEvent(new MouseEvent(type,o));}catch(err){}}",
      "function hover(moved){var el=document.elementFromPoint(cx,cy);",
      "if(el!==hv){",
      "if(hv){fire(hv,'pointerout',1);fire(hv,'mouseout',1);fire(hv,'pointerleave',0);fire(hv,'mouseleave',0);}",
      "for(var n=hv;n;n=n.parentElement)if(n.classList)n.classList.remove(HV);",
      "for(var m=el;m;m=m.parentElement)if(m.classList)m.classList.add(HV);",
      "hv=el;",
      "if(el){fire(el,'pointerover',1);fire(el,'mouseover',1);fire(el,'pointerenter',0);fire(el,'mouseenter',0);}}",
      "if(moved&&el){fire(el,'pointermove',1);fire(el,'mousemove',1);}",
      "setShape(kindOf(el));}",
      "function clickAtCursor(){hover(false);var el=hv;if(!el)return;",
      "['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(n){fire(el,n,1);});",
      "if(el.focus){try{el.focus();}catch(err){}}}",
      // touch handling: one finger drives the cursor, two fingers are left to the browser (pinch zoom)
      "function onTS(e){if(e.touches.length>1){gesture=true;return;}",
      "var t=e.touches[0];if(!t)return;",
      "gesture=false;active=true;moved=false;t0=Date.now();sx=lx=t.clientX;sy=ly=t.clientY;}",
      "function onTM(e){if(gesture||e.touches.length>1){gesture=true;return;}",
      "var t=e.touches[0];if(!t)return;",
      "if(!moved&&Math.abs(t.clientX-sx)+Math.abs(t.clientY-sy)>10){moved=true;lx=sx;ly=sy;}",
      "if(moved){nudge((t.clientX-lx)*SPEED,(t.clientY-ly)*SPEED);hover(true);}",
      "lx=t.clientX;ly=t.clientY;}",
      "function onTE(e){if(e.touches.length>0)return;",
      "if(active&&!moved&&!gesture&&Date.now()-t0<300)clickAtCursor();",
      "active=false;gesture=false;}",
      // keep every real (trusted) input event away from the page's own handlers
      "var types=['touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove',",
      "'pointerup','pointercancel','mousedown','mousemove','mouseup','click','dblclick',",
      "'contextmenu','wheel'];",
      "var o={capture:true,passive:false};",
      "function block(e){if(!e.isTrusted)return;var ty=e.type;",
      "if(ty==='touchstart')onTS(e);",
      "else if(ty==='touchmove')onTM(e);",
      "else if(ty==='touchend')onTE(e);",
      "else if(ty==='touchcancel'){active=false;gesture=false;}",
      "if(ty.indexOf('touch')!==0&&e.cancelable)e.preventDefault();",
      "e.stopImmediatePropagation();}",
      "types.forEach(function(t){window.addEventListener(t,block,o);});",
      "var vv=window.visualViewport;",
      "function vp(){nudge(0,0);}",
      "if(vv){vv.addEventListener('resize',vp);vv.addEventListener('scroll',vp);}",
      // layout can change under a resting cursor (after a click, animations)
      "var iv=setInterval(function(){hover(false);},250);",
      "window.__acodeCursorCleanup=function(){",
      "clearInterval(iv);",
      "types.forEach(function(t){window.removeEventListener(t,block,o);});",
      "if(vv){vv.removeEventListener('resize',vp);vv.removeEventListener('scroll',vp);}",
      "for(var n=hv;n;n=n.parentElement)if(n.classList)n.classList.remove(HV);",
      "if(c.parentNode)c.parentNode.removeChild(c);",
      "if(st.parentNode)st.parentNode.removeChild(st);};",
      "setShape('arrow');hover(false);",
      "})",
    };

    StringBuilder sb = new StringBuilder();
    for (String line : js) {
      sb.append(line).append('\n');
    }
    sb.append('(').append(on).append(',').append(speed).append(");");
    return sb.toString();
  }
}

class BrowserChromeClient extends WebChromeClient {

  Browser browser;

  public BrowserChromeClient(Browser browser) {
    super();
    this.browser = browser;
  }

  @Override
  public void onReceivedTitle(WebView view, String title) {
    super.onReceivedTitle(view, title);
    browser.setTitle(title);
  }

  @Override
  public void onReceivedIcon(WebView view, Bitmap icon) {
    super.onReceivedIcon(view, icon);
    browser.setFavicon(icon);
  }

  public boolean onShowFileChooser(
    WebView webView,
    ValueCallback<Uri[]> filePathCallback,
    WebChromeClient.FileChooserParams fileChooserParams
  ) {
    if (browser.filePathCallback != null) {
      browser.filePathCallback.onReceiveValue(null);
    }
    browser.filePathCallback = filePathCallback;

    String[] acceptTypes = fileChooserParams.getAcceptTypes();
    String mimeType = "*/*"; // default if empty or null
    if (acceptTypes != null && acceptTypes.length > 0) {
      String firstType = acceptTypes[0];
      if (firstType != null && !firstType.trim().isEmpty()) {
        mimeType = firstType;
      }
    }

    Intent selectDocument = new Intent(Intent.ACTION_GET_CONTENT);
    selectDocument.addCategory(Intent.CATEGORY_OPENABLE);
    selectDocument.setType(mimeType);

    boolean isMultiple =
      (fileChooserParams.getMode() ==
        WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
    if (isMultiple) {
      selectDocument.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
    }

    ((Activity) webView.getContext()).startActivityForResult(
        Intent.createChooser(selectDocument, "Select File"),
        browser.FILE_SELECT_CODE
      );

    return true;
  }
}

class BrowserWebViewClient extends WebViewClient {

  private Browser browser;

  public BrowserWebViewClient(Browser browser) {
    super();
    this.browser = browser;
  }

  @Override
  public boolean shouldOverrideUrlLoading(WebView view, String url) {
    browser.setUrl(url);
    browser.setProgressBarVisible(true);
    return false;
  }

  @Override
  public void onPageStarted(WebView view, String url, Bitmap icon) {
    super.onPageStarted(view, url, icon);
    browser.setProgressBarVisible(true);
  }

  @Override
  public void onPageFinished(WebView view, String url) {
    super.onPageFinished(view, url);
    browser.setProgressBarVisible(false);

    // Navigation wipes injected overlays, so re-apply the cursor if enabled.
    if (browser.cursor) {
      browser.applyCursor();
    }

    // Inject console for external sites
    // this is not a good solution but for now its good, later we'll improve this
    if (!url.startsWith("http://localhost")) {
      try {
        File eruaFile = new File(browser.context.getFilesDir(), "eruda.js");
        StringBuilder scriptContent = new StringBuilder();
        BufferedReader reader = new BufferedReader(new FileReader(eruaFile));
        String line;
        while ((line = reader.readLine()) != null) {
          scriptContent.append(line);
          scriptContent.append("\n");
        }
        reader.close();

        // Inject the script content directly
        String script =
          "if(!window.eruda){" +
          "  var script = document.createElement('script');" +
          "  script.textContent = `" +
          scriptContent.toString() +
          "`;" +
          "  document.head.appendChild(script);" +
          "  eruda.init({" +
          "    theme: 'dark'" +
          "  });" +
          "  eruda._shadowRoot.querySelector('.eruda-entry-btn').style.display = 'none';" +
          "  sessionStorage.setItem('__console_available', true);" +
          "  document.addEventListener('showconsole', function() { eruda.show(); });" +
          "  document.addEventListener('hideconsole', function() { eruda.hide(); });" +
          "}";

        browser.webView.evaluateJavascript(script, null);
      } catch (IOException e) {
        e.printStackTrace();
        // Fallback to CDN if local file fails
        String fallbackScript =
          "if(!window.eruda){" +
          "  var script = document.createElement('script');" +
          "  script.src = 'https://cdn.jsdelivr.net/npm/eruda';" +
          "  script.crossOrigin = 'anonymous';" +
          "  script.onload = function() {" +
          "    eruda.init({" +
          "      theme: 'dark'" +
          "    });" +
          "    eruda._shadowRoot.querySelector('.eruda-entry-btn').style.display = 'none';" +
          "    sessionStorage.setItem('__console_available', true);" +
          "    document.addEventListener('showconsole', function() { eruda.show(); });" +
          "    document.addEventListener('hideconsole', function() { eruda.hide(); });" +
          "  };" +
          "  document.head.appendChild(script);" +
          "}";
        browser.webView.evaluateJavascript(fallbackScript, null);
      }
      browser.menu.setChecked("Console", false);
    } else {
      browser.webView.evaluateJavascript(
        "sessionStorage.getItem('__console_available')",
        new ValueCallback<String>() {
          @Override
          public void onReceiveValue(String value) {
            boolean show = !value.equals("null");
            browser.menu.setVisible("Console", show && !browser.emulator);

            // If user had toggled "Console" on before, re-show it
            if (browser.console && show) {
              browser.setConsoleVisible(true);
              browser.menu.setChecked("Console", true);
            }
          }
        }
      );
    }
  }

  @Override
  public void onLoadResource(WebView view, String url) {
    browser.setDesktopMode();
  }
}
