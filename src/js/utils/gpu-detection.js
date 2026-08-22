/**
 * Copyright 2026 Krisztián Nagy
 * @file A simple and standalone module to extract some basic and standardized details about the GPU from the
 * unmasked WebGL vendor / renderer strings.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

define(function () {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * @enum {String}
             * The possible values for the detected brand (i.e. chip designer/manufacturer) of a graphics card.
             * NVIDIA / AMD / INTEL are desktop and laptop dedicated or integrated cards; APPLE covers both iOS/iPadOS ("Apple GPU")
             * and Apple Silicon Mac ("Apple M#"); QUALCOMM (Adreno) / ARM (Mali) / IMAGINATION (PowerVR, also used by some Unisoc chips) /
             * SAMSUNG (Xclipse) are phone/tablet-only GPU makers.
             */
            GPUBrand = {
                NVIDIA: "NVIDIA",
                AMD: "AMD",
                INTEL: "Intel",
                APPLE: "Apple",
                QUALCOMM: "Qualcomm",
                ARM: "ARM",
                IMAGINATION: "Imagination",
                SAMSUNG: "Samsung",
                OTHER: "Other"
            },
            // ------------------------------------------------------------------------------
            // regexes
            /**
             * Matches "ATI" as a whole word - the pre-acquisition brand name some older AMD cards still report.
             * @type RegExp
             */
            ATI_REGEX = /\bati\b/,
            /**
             * Matches the literal "ANGLE" anywhere - used to tell an Apple Silicon Mac's ANGLE-wrapped renderer string apart from
             * iOS/iPadOS's bare, unwrapped "Apple GPU" string.
             * @type RegExp
             */
            ANGLE_REGEX = /ANGLE/i,
            /**
             * Matches (and captures the inner content of) the outer "ANGLE (...)" wrapper that most Chromium browsers use.
             * @type RegExp
             */
            ANGLE_WRAPPER_REGEX = /^ANGLE \((.*)\)$/i,
            /**
             * Matches (and strips) macOS's "ANGLE Metal Renderer: " marker prefix (e.g. "ANGLE Metal Renderer: Apple M1 Pro") - the
             * actual model follows this literal marker, rather than the more usual case of the API name being a trailing/removable
             * suffix.
             * @type RegExp
             */
            ANGLE_METAL_RENDERER_REGEX = /^.*ANGLE Metal Renderer:\s*/i,
            /**
             * Matches (and captures the inner content of) a second, nested "ANGLE (...) on <API>" wrapper that some Android devices
             * (e.g. Samsung Xclipse) use around just the model, inside the outer ANGLE wrapper.
             * @type RegExp
             */
            NESTED_ANGLE_WRAPPER_REGEX = /^ANGLE\s*\(([^)]*)\)\s*on\b/i,
            /**
             * Matches (and strips) a trailing graphics API name (Direct3D / OpenGL(ES) / Vulkan / Metal) together with everything
             * after it (version numbers, shader model suffixes, etc.).
             * @type RegExp
             */
            GRAPHICS_API_SUFFIX_REGEX = /\s+(Direct3D\d*|OpenGL(?:\s?ES)?[\s\d.]*|Vulkan[\s\d.]*|Metal).*$/i,
            /**
             * Matches (and strips) a trailing bus info suffix, e.g. "/PCIe/SSE2".
             * @type RegExp
             */
            BUS_INFO_SUFFIX_REGEX = /\/[^,]*$/,
            /**
             * Matches any parenthesized content (hex device IDs, codenames, driver/build details, trademark markers, ...) - none of it
             * is needed for a general family name, and keeping any of it risks it reading as a fingerprinting-grade detail.
             * @type RegExp
             */
            PARENTHESIZED_CONTENT_REGEX = /\([^)]*\)/g,
            /**
             * Matches Linux Mesa driver-stack keywords that are not part of the actual product name.
             * @type RegExp
             */
            DRIVER_STACK_KEYWORD_REGEX = /\b(Mesa|DRI|LLVM|DRM)\b/gi,
            /**
             * Matches any of the recognized vendor/manufacturer names - stripped from the model since the vendor is already available
             * separately (see detectBrand()).
             * @type RegExp
             */
            VENDOR_NAME_REGEX = /\b(nvidia|amd|ati|intel|apple|arm|qualcomm|samsung|imagination)\b/gi,
            /**
             * Matches (and collapses) runs of 2 or more spaces left behind after other stripping.
             * @type RegExp
             */
            EXTRA_SPACE_REGEX = /\s{2,}/g,
            /**
             * Matches (and, where used with exec(), captures the model number of) an AMD Radeon RX-series model, e.g. "RX 6800".
             * @type RegExp
             */
            AMD_RX_SERIES_REGEX = /\brx\s*(\d{3,4})/i,
            /**
             * Matches AMD's legacy R9/R7/R5 dedicated series naming, e.g. "R9 290".
             * @type RegExp
             */
            AMD_LEGACY_R_SERIES_REGEX = /\br[579]\s*\d{3}/i,
            /**
             * Matches AMD's legacy Radeon HD dedicated series naming, e.g. "HD 7970".
             * @type RegExp
             */
            AMD_HD_SERIES_REGEX = /\bhd\s*\d{4}/i,
            /**
             * Matches AMD's Vega 56/64 flagship models, which are dedicated and high-end despite not fitting the RX-series naming.
             * @type RegExp
             */
            AMD_VEGA_FLAGSHIP_REGEX = /\bvega\s*(56|64)\b/i,
            /**
             * Matches AMD's Fury/Nano flagship models, which are dedicated and high-end despite not fitting the RX-series naming.
             * @type RegExp
             */
            AMD_FURY_NANO_REGEX = /\b(fury|nano)\b/i,
            /**
             * Matches Intel's Arc dedicated GPU series naming, e.g. "Arc A770".
             * @type RegExp
             */
            INTEL_ARC_REGEX = /\barc\b/i,
            /**
             * Matches (and captures) the first run of 3 to 4 digits in a model name - used to read an NVIDIA GeForce/RTX model number.
             * @type RegExp
             */
            MODEL_NUMBER_REGEX = /(\d{3,4})/,
            /**
             * Matches NVIDIA's TITAN flagship models, which are always high-end regardless of a numeric tier match.
             * @type RegExp
             */
            NVIDIA_TITAN_REGEX = /\btitan\b/i;
    Object.freeze(GPUBrand);
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Determines the brand (enum GPUBrand) of the graphics card based on the passed unmasked WebGL vendor / renderer strings. Software /
     * virtual renderers (no real GPU) are reported as OTHER.
     * @param {String} vendor
     * @param {String} renderer
     * @returns {String} (enum GPUBrand)
     */
    function _detectBrand(vendor, renderer) {
        var text = ((vendor || "") + " " + (renderer || "")).toLowerCase();
        // software / virtual renderers (no real GPU):
        if ((text.indexOf("swiftshader") >= 0) || (text.indexOf("llvmpipe") >= 0) || (text.indexOf("software rasterizer") >= 0) ||
                (text.indexOf("basic render driver") >= 0) || (text.indexOf("vmware") >= 0) || (text.indexOf("virtualbox") >= 0)) {
            return GPUBrand.OTHER;
        }
        // actual recognized GPU brands:
        if (text.indexOf("nvidia") >= 0) {
            return GPUBrand.NVIDIA;
        }
        if ((text.indexOf("amd") >= 0) || (text.indexOf("radeon") >= 0) || ATI_REGEX.test(text)) {
            return GPUBrand.AMD;
        }
        if (text.indexOf("intel") >= 0) {
            return GPUBrand.INTEL;
        }
        if ((text.indexOf("adreno") >= 0) || (text.indexOf("qualcomm") >= 0)) {
            return GPUBrand.QUALCOMM;
        }
        // not checking for ARM itself: "ARM" also names the (unrelated) CPU architecture that every mobile SoC uses
        if (text.indexOf("mali") >= 0) {
            return GPUBrand.ARM;
        }
        if ((text.indexOf("powervr") >= 0) || (text.indexOf("imagination") >= 0)) {
            return GPUBrand.IMAGINATION;
        }
        // not checking for Samsung itself: most Samsung phones actually ship Qualcomm Adreno chips
        if (text.indexOf("xclipse") >= 0) {
            return GPUBrand.SAMSUNG;
        }
        if (text.indexOf("apple") >= 0) {
            return GPUBrand.APPLE;
        }
        return GPUBrand.OTHER;
    }
    /**
     * Returns whether the graphics card identified by the passed brand is a mobile (phone/tablet) one. QUALCOMM / ARM / IMAGINATION /
     * SAMSUNG are always mobile (none of these are used in desktop GPUs). APPLE is mobile only for iOS/iPadOS: those report a bare,
     * unwrapped "Apple GPU" string with no chip distinction, while an Apple Silicon Mac's renderer is always wrapped in an ANGLE Metal
     * renderer description, which is what tells the two
     * apart here.
     * @param {String} brand (enum GPUBrand)
     * @param {String} renderer The raw (unprocessed) renderer string, as also passed to detectBrand() / extractModel().
     * @returns {Boolean}
     */
    function _isMobile(brand, renderer) {
        switch (brand) {
            case GPUBrand.QUALCOMM:
            case GPUBrand.ARM:
            case GPUBrand.IMAGINATION:
            case GPUBrand.SAMSUNG:
                return true;
            case GPUBrand.APPLE:
                return !ANGLE_REGEX.test(renderer || "");
            default:
                return false;
        }
    }
    /**
     * Extracts a reduced, general graphics card family name from the passed unmasked WebGL renderer string. The goal is to just
     * identify the product family (e.g. "GeForce GTX 1080", "Radeon RX 6800", "Intel Arc A770") without any extra details.
     * This is to be used for determining general product tier and recency to estimate performance for adaptive graphics setting
     * defaults and to display it to the user cleanly (as an explanation on why the specific defaults were chosen).
     * @param {String} renderer
     * @returns {String}
     */
    function _extractModel(renderer) {
        var model = renderer || "", match, parts;
        match = ANGLE_WRAPPER_REGEX.exec(model);
        if (match) {
            parts = match[1].split(", ");
            model = (parts.length > 1) ? parts[1] : parts[0];
        }
        model = model.replace(ANGLE_METAL_RENDERER_REGEX, "");
        match = NESTED_ANGLE_WRAPPER_REGEX.exec(model);
        if (match) {
            model = match[1];
        }
        model = model.replace(GRAPHICS_API_SUFFIX_REGEX, "");
        model = model.replace(BUS_INFO_SUFFIX_REGEX, "");
        model = model.replace(PARENTHESIZED_CONTENT_REGEX, "");
        model = model.replace(DRIVER_STACK_KEYWORD_REGEX, "");
        model = model.replace(VENDOR_NAME_REGEX, "");
        model = model.replace(EXTRA_SPACE_REGEX, " ");
        return model.trim();
    }
    /**
     * Returns whether the graphics card identified by the passed brand / model is a dedicated (as opposed to integrated) one. Only
     * meaningful for desktop brands (NVIDIA / AMD / INTEL).
     * @param {String} brand (enum GPUBrand)
     * @param {String} model
     * @returns {Boolean}
     */
    function _isDedicated(brand, model) {
        switch (brand) {
            case GPUBrand.NVIDIA:
                return true;
            case GPUBrand.AMD:
                return AMD_RX_SERIES_REGEX.test(model) || AMD_LEGACY_R_SERIES_REGEX.test(model) || AMD_HD_SERIES_REGEX.test(model) ||
                        AMD_VEGA_FLAGSHIP_REGEX.test(model) || AMD_FURY_NANO_REGEX.test(model);
            case GPUBrand.INTEL:
                return INTEL_ARC_REGEX.test(model);
            default:
                return false;
        }
    }
    /**
     * Returns whether the graphics card identified by the passed brand / model belongs to a relatively recent (~2020+) generation,
     * regardless of its performance tier within that generation. Only meaningful for desktop brands (NVIDIA / AMD / INTEL).
     * @param {String} brand (enum GPUBrand)
     * @param {String} model
     * @returns {Boolean}
     */
    function _isRecent(brand, model) {
        var match;
        switch (brand) {
            case GPUBrand.NVIDIA:
                match = MODEL_NUMBER_REGEX.exec(model);
                if (!match) {
                    return false;
                }
                return Math.floor(parseInt(match[1], 10) / 100) >= 30;
            case GPUBrand.AMD:
                match = AMD_RX_SERIES_REGEX.exec(model);
                if (!match) {
                    return false;
                }
                return parseInt(match[1], 10) >= 1000;
            case GPUBrand.INTEL:
                return INTEL_ARC_REGEX.test(model);
            default:
                return false;
        }
    }
    /**
     * Returns whether the graphics card identified by the passed brand / model is (approximately) a high performance tier one for its generation.
     * Only meaningful for desktop brands (NVIDIA / AMD).
     * @param {String} brand (enum GPUBrand)
     * @param {String} model
     * @returns {Boolean}
     */
    function _isHighEnd(brand, model) {
        var match, number, tier;
        switch (brand) {
            case GPUBrand.NVIDIA:
                // TITAN models are always high-end, regardless of numeric tier
                if (NVIDIA_TITAN_REGEX.test(model)) {
                    return true;
                }
                // last two digits of the model number determine the tier: 70+ is considered high-end here
                match = MODEL_NUMBER_REGEX.exec(model);
                if (!match) {
                    return false;
                }
                return (parseInt(match[1], 10) % 100) >= 70;
            case GPUBrand.AMD:
                // Vega 56/64 and Fury/Nano are considered high-end
                if (AMD_VEGA_FLAGSHIP_REGEX.test(model) || AMD_FURY_NANO_REGEX.test(model)) {
                    return true;
                }
                // RX-series models: 
                match = AMD_RX_SERIES_REGEX.exec(model);
                if (!match) {
                    return false;
                }
                number = parseInt(match[1], 10);
                tier = ((number >= 1000) && (number <= 7000)) ?
                    (Math.floor((number % 1000) / 100) * 10) : // RX 5XXX/6XXX/7XXX: hundreds digit is the tier
                    (number % 100); // RX 4XX/5XX and RX 9XXX: last two digits are the tier
                return tier >= 70;
                // older than RX-series AMD card are never considered high-end here
            default:
                return false;
        }
    }
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * @typedef {Object} GPUInfo
     * @property {String} brand (enum GPUBrand) The detected chip designer/manufacturer
     * @property {String} model The extracted, reduced general product family name
     * @property {Boolean} mobile Whether this is a mobile (phone/tablet) GPU
     * @property {Boolean} dedicated Whether this is a dedicated (as opposed to integrated) card. Always false for mobile GPUs.
     * @property {Boolean} recent Whether this belongs to a relatively recent (~2020+) generation. Always false for mobile GPUs.
     * @property {Boolean} highEnd Whether this is a high performance tier one for its generation. Always false for mobile GPUs.
     */
    /**
     * Extracts some basic and standardized details about the GPU from the passed unmasked WebGL vendor / renderer strings. If no
     * vendor / renderer is passed, returns a default OTHER/unknown result.
     * @param {String} [vendor] The unmasked WebGL vendor string (from the WEBGL_debug_renderer_info extension).
     * @param {String} [renderer] The unmasked WebGL renderer string (from the WEBGL_debug_renderer_info extension).
     * @returns {GPUInfo}
     */
    function extractInfo(vendor, renderer) {
        var brand = _detectBrand(vendor, renderer), model = _extractModel(renderer);
        return {
            brand: brand,
            model: model,
            mobile: _isMobile(brand, renderer),
            dedicated: _isDedicated(brand, model),
            recent: _isRecent(brand, model),
            highEnd: _isHighEnd(brand, model)
        };
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        extractInfo: extractInfo
    };
});
