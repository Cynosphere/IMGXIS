// ==UserScript==
// @name        IMGXIS
// @namespace   http://yellowafterlife.itch.io/imgxis
// @version     1.06
// @description A userscript for better image viewing experience in browsers.
// @match       *://*/*.png*
// @match       *://*/*.jpg*
// @match       *://*/*.jpeg*
// @match       *://*/*.gif*
// @match       *://*/*.bmp*
// @grant       GM_getValue
// @grant       GM_setValue
// @copyright   2015+, YellowAfterlife
// ==/UserScript==
// Revisions:
// 1.06 (Sep 28, 2015): No longer blocking the default behaviour for alt+dragging the image.
// 1.05 (Sep 26, 2015): Added a color picker (Ctrl+C to copy a color under the cursor);
// 1.04 (Sep 25, 2015): Image are now "smoothed" when zoomed out; Fixed Firefox beta compatibilty.
// 1.03 (Sep 24, 2015): Added a button to view the image in tiled form.
// 1.02 (Jul 19, 2015): F5 now refreshes image without reloading the page. Shift+F5 for timer.
// 1.01 (Apr 01, 2015): Added color presets (instead of a single color for all slots).
// 1.00 (Mar 31, 2015): Initial release.
// parameter group:
var menuButtonWidth = 32; // in pixels
var menuColors = 10; // how many color buttons to show in the menu
var colorPickerEnabled = true; // whether to allow to Ctrl+C colors from the image
var colorPickerMode = 0; // 0: hex, 1: rgb, 2: rgba
// ensure that the page contains nothing but a single <img>:
if (document.body.children.length != 1) return;
var q = document.body.children[0];
if (q.tagName != "IMG") return;
// stylesheet:
var css = document.createElement("style");
css.type = "text/css";
css.innerHTML = [
    "body {",
	" background-image: none;",
	" overflow: hidden;",
	"}",
    // panner area
    ".imgxis-panner {",
    " position: absolute;",
    " left: 0; width: 100%;",
    " top: 0; height: 100%;",
    "}",
    // cursors
    ".imgxis-panner, .imgxis-panner img {",
    " cursor: move;",
    "}",
    ".imgxis-panner.colorpick, .imgxis-panner.colorpick img {",
    " cursor: default;",
    " cursor: copy;",
    "}",
	// disable interpolation:
	".imgxis-panner.zoomed, .imgxis-panner.zoomed img {",
	" -ms-interpolation-mode: nearest-neighbor;",
    " image-rendering: optimizeSpeed;",
    " image-rendering: -moz-crisp-edges;",
    " image-rendering: -webkit-optimize-contrast;",
    " image-rendering: -o-crisp-edges;",
    " image-rendering: pixelated;",
	"}",
    // actual image:
    ".imgxis-panner img {",
    // disable Firefox' centering:
    " position: relative;",
    " margin: 0;",
    "}",
    // menu pane on top:
    ".imgxis-menu {",
    " position: absolute;",
    " left: 0; width: 100%;",
    " top: 0; height: 24px;",
    " background: rgba(0, 0, 0, 0.7);",
    " padding: 4px;",
    " color: white;",
    " font: 16px sans-serif;",
    " line-height: 24px;",
    " min-width: 1024px;",
    "}",
    // style the buttons in the menu:
    ".imgxis-menu input {",
    " width: " + menuButtonWidth + "px;",
    " height: 24px;",
    " padding: 0px;",
    " margin-right: 2px;",
    " float: left;",
    "}",
].join("\n");
document.body.appendChild(css);
// the thing is that browser has it's own zoom in controls, and they are
// linked to that particular <img> natively. So we need to make a copy of it, strip
// it of any unneeded styles, and put it in place of the original:
var o = q.cloneNode();
o.removeAttribute("width");
o.removeAttribute("height");
var panner = document.createElement("div");
var pannerZoomed = false;
panner.className = "imgxis-panner";
panner.appendChild(o);
q.parentNode.appendChild(panner);
q.parentNode.removeChild(q);
var s = o.style;
s.transformOrigin = "top left";
q = null;
var tile = false;
//
var w = 0, h = 0, x = 0, y = 0, z = 0, m = 1;
// pan and zoom:
function update() {
    var pz = (m > 1);
    if (pz != pannerZoomed) {
        pannerZoomed = pz;
        var cl = panner.classList;
        if (pz) cl.add("zoomed"); else cl.remove("zoomed");
    }
    if (tile) {
        var p = panner.style;
        p.backgroundPosition = -x + "px " + -y + "px";
        p.backgroundSize = (o.width * m) + "px";
    }
    s.transform = "matrix(" + m + ",0,0," + m + "," + -x + "," + -y + ")";
}
function zoomto(zx, zy, d) {
    var p = m; m = Math.pow(2, z += d);
    var f = m / p;
    x = (zx + x) * f - zx;
    y = (zy + y) * f - zy;
    menu_zoom.innerHTML = (0 | m * 100) + "%";
    update();
}

// color picker:
var colorPickerCanvas = document.createElement("canvas");
var colorPickerContext = colorPickerCanvas.getContext("2d");
var colorPickerColor = document.createElement("input");
colorPickerColor.type = "color";
colorPickerColor.style.width = "24px";
var colorPickerField = document.createElement("input");
colorPickerField.type = "text";
colorPickerField.style.width = "64px";
colorPickerColor.title = colorPickerField.title = "Ctrl+C to copy a color under the cursor in here.";
var colorPickerActive = false;
function colorPickerUpdate() {
    var w = o.width;
    var h = o.height;
    if (w <= 0 || h <= 0) return;
    if (colorPickerCanvas.width != w) {
        colorPickerCanvas.width = w;
    } else if (colorPickerCanvas.height != h) {
        colorPickerCanvas.height = h;
    } else colorPickerContext.clearRect(0, 0, w, h);
    colorPickerContext.drawImage(o, 0, 0);
    var rx = (mx + x) / m; rx %= w; if (rx < 0) rx += w;
    var ry = (my + y) / m; ry %= h; if (ry < 0) ry += h;
    try {
        var d = colorPickerContext.getImageData(~~rx, ~~ry, 1, 1).data;
        var hex = "0123456789ABCDEF";
        var chx = "#";
        for (k = 0; k < 3; k++) chx += hex.charAt(d[k] >> 4) + hex.charAt(d[k] & 15);
        //
        var out = "", i, k;
        switch (colorPickerMode) {
        case 1: out = d[0] + "," + d[1] + "," + d[2]; break;
        case 2: out = d[0] + "," + d[1] + "," + d[2] + "," + (d[3] / 255).toFixed(3); break;
        default: out = chx;
        }
        colorPickerColor.value = chx;
        colorPickerField.value = out;
        colorPickerField.select();
    } catch (_) {
        colorPickerField.value = "(error)";
    }
}
function colorPickerDeactivate() {
    colorPickerActive = false;
    panner.classList.remove("colorpick");
}

// menu:
var menu_zoom = null, menu;
(function() {
    menu = document.createElement("div");
    menu.className = "imgxis-menu";
    function menubt(s, f) {
        var bt = document.createElement("input");
        bt.type = "button";
        bt.value = s;
        bt.addEventListener("click", f);
        menu.appendChild(bt);
    }
    var defcolors = [
        "#6A86B7", "#60C19D", "#AB7680", "#FFFFFF", "#F4F2EC",
        "#CAC2BD", "#88898E", "#4F556A", "#1D1F2C", "#000000",
    ];
    function menucl(i) {
        var bt = document.createElement("input");
        bt.type = "color";
        bt.value = GM_getValue("imgxis-color" + i, defcolors[i]);
        function bt_apply() {
            document.body.style.backgroundColor = bt.value;
        };
        bt.addEventListener("click", function(e) {
            if (!e.shiftKey) {
                e.preventDefault();
                bt_apply();
            }
        });
        bt.addEventListener("change", function(e) {
            GM_setValue("imgxis-color" + i, bt.value);
            bt_apply();
        });
        bt.title = "Color " + (i + 1) + ".\nClick to apply.\nShift+click to change.";
        menu.appendChild(bt);
        if (i == 0) bt_apply();
    }
    for (var i = 0; i < menuColors; i++) menucl(i);
    menubt("-", function(_) { zoomto(window.innerWidth / 2, window.innerHeight / 2, -0.5) });
    menubt("1:1", function(_) {
        var iw = window.innerWidth, ih = window.innerHeight;
        zoomto(iw / 2, ih / 2, -z);
        x = (w - iw) / 2;
        y = (h - ih) / 2;
        update();
    });
    menubt("+", function(_) { zoomto(window.innerWidth / 2, window.innerHeight / 2, 0.5) });
    menubt("tile", function(_) {
        tile = !tile;
        panner.style.backgroundImage = tile ? "url(" + o.src + ")" : "";
        update();
    });
    //
    if (colorPickerEnabled) {
        menu.appendChild(colorPickerColor);
        menu.appendChild(colorPickerField);
    }
    //
    menu_zoom = document.createElement("span");
    menu_zoom.innerHTML = "100%";
    menu.appendChild(menu_zoom);
    document.body.appendChild(menu);
})();
// mouse controls:
function onmousewheel(e) {
    var d = e.wheelDelta || -e.detail;
    d = (d < 0 ? -1 : d > 0 ? 1 : 0) * 0.5;
    zoomto(e.pageX, e.pageY, d);
}
var mx = 0, my = 0, mp = false;
function onmousemove(e) {
    var ox = mx; mx = e.pageX; var dx = mx - ox;
    var oy = my; my = e.pageY; var dy = my - oy;
    if (mp) {
        x -= (mx - ox);
        y -= (my - oy);
        update();
    } else if (colorPickerActive) {
        colorPickerUpdate();
    }
}
function onmousedown(e) {
    onmousemove(e);
    if (e.which != 3 && !e.altKey) { // not the right click
        e.preventDefault(); // disable image "grab"
        mp = true;
    }
}
function onmouseup(e) {
    onmousemove(e);
    mp = false;
}

//
var refresh_timer = null;
function refresh() {
    var o_src = o.src;
    // strip the previous timestamp parameter:
    var pos = o_src.indexOf("imgxis-time");
    if (pos >= 0) {
        switch (o_src.charAt(pos - 1)) {
            case "&": case "?": pos--; break;
        }
        o_src = o_src.substring(0, pos);
    }
    // add a timestamp parameter:
    o_src += o_src.indexOf("?") >= 0 ? "&" : "?";
    o_src += "imgxis-time=" + Date.now();
    //
    o.src = o_src;
    if (tile) panner.style.backgroundImage = "url(" + o.src + ")";
}

//
function onkeydown(e) {
    switch (e.keyCode) {
    case 17: if (colorPickerEnabled) {
        colorPickerActive = true;
        colorPickerUpdate();
        panner.classList.add("colorpick");
    }; break;
    case 116:
        e.preventDefault();
        if (e.shiftKey) {
            if (refresh_timer == null) {
                var t = parseFloat(prompt("Refresh interval (seconds)", "15"));
                if (!isNaN(t)) refresh_timer = setInterval(refresh, Math.max(100, t * 1000));
            } else clearInterval(refresh_timer);
        } else refresh();
        break;
    }
}
function onkeyup(e) {
    switch (e.keyCode) {
    case 17:
        if (colorPickerActive) colorPickerDeactivate();
        break;
    }
}
function onblur(e) {
    if (colorPickerActive) colorPickerDeactivate();
}
window.addEventListener("mousemove", onmousemove);
panner.addEventListener("mousedown", onmousedown);
window.addEventListener("mouseup", onmouseup);
window.addEventListener("mousewheel", onmousewheel);
window.addEventListener("DOMMouseScroll", onmousewheel);
window.addEventListener("keydown", onkeydown);
window.addEventListener("keyup", onkeyup);
window.addEventListener("blur", onblur);
// consider that the image dimensions may not be available instantly:
var onwait_t = 1000;
var onwait = function onwait() {
    w = o.width; h = o.height;
    if (w > 0 && h > 0) {
        var iw = window.innerWidth, lw = w;
        var ih = window.innerHeight, lh = h;
        if (lw < iw && lh < ih) for (var k = 0; k < 3; k++) {
            if (lw * 2 < iw && lh * 2 < ih) { z++; lw *= 2; lh *= 2 }
        } else while (lw > iw || lh > ih) { z--; lw /= 2; lh /= 2; }
        m = Math.pow(2, z);
        menu_zoom.innerHTML = (0 | m * 100) + "%";
        x = -(iw - lw) / 2;
        y = -(ih - lh) / 2;
        update();
    } else if (--onwait_t > 0) setTimeout(onwait, 10);
}
onwait();
