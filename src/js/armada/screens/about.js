/**
 * Copyright 2014-2018, 2020-2025 Krisztián Nagy
 * @file This module manages and provides the About screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param game Used for navigation and displaying the game version
 * @param screens The about screen is a subclass of HTMLScreen
 * @param strings Used for translation support
 * @param armadaScreens Used for navigation
 */
define([
    "modules/game",
    "modules/screens",
    "armada/strings",
    "armada/screens/shared"
], function (game, screens, strings, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            VERSION_PARAGRAPH_ID = "versionParagraph",
            ABOUT_GAME_DEV_PARAGRAPH_ID = "aboutGameDevParagraph",
            USED_SOFTWARE_PARAGRAPH_ID = "usedSoftwareParagraph",
            LICENSE_PARAGRAPH_ID = "licenseParagraph",
            LICENSE_ELECTRON_PARAGRAPH_ID = "licenseElectronParagraph";
    // ------------------------------------------------------------------------------
    // private functions
    function _compareNames(a, b) {
        return a.textContent.localeCompare(b.textContent);
    }
    function _link(url, name) {
        return '<a target="_blank" rel="noopener" href="' + url + '">' + name + '</a>';
    }
    // ##############################################################################
    /**
     * @class A class to represent the "About" screen in the game. Describes the dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function AboutScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.ABOUT_SCREEN_NAME,
                armadaScreens.ABOUT_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.ABOUT_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "escape": function () {
                        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                    }
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._versionParagraph = this.registerSimpleComponent(VERSION_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._aboutGameDevParagraph = this.registerSimpleComponent(ABOUT_GAME_DEV_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._aboutLicenseParagraph = this.registerSimpleComponent(LICENSE_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._aboutUsedSoftwareParagraph = this.registerSimpleComponent(USED_SOFTWARE_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._aboutLicenseElectronParagraph = this.registerSimpleComponent(LICENSE_ELECTRON_PARAGRAPH_ID);

    }
    AboutScreen.prototype = new screens.HTMLScreen();
    AboutScreen.prototype.constructor = AboutScreen;
    /**
     * @override
     */
    AboutScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    AboutScreen.prototype._updateComponents = function () {
        var names, i, j, index, nameParts, reversed, nameLists;
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._versionParagraph.customizeContent({version: game.getVersion() + " (" + game.getPlatform() + ")"});
        this._aboutGameDevParagraph.customizeContent({
            facebook: _link("https://www.facebook.com/interstellar.armada", "facebook"),
            github: _link("https://github.com/nkrisztian89/interstellar-armada", "github"),
            patreon: _link("https://www.patreon.com/c/Entian", "Patreon"),
            email: _link("mailto:armada.galactic.ace@gmail.com", "email")
        });
        this._aboutUsedSoftwareParagraph.customizeContent({
            inkscape: _link("https://inkscape.org", "Inkscape"),
            blender: _link("https://www.blender.org/", "Blender"),
            gimp: _link("https://www.gimp.org", "GIMP"),
            audacity: _link("https://www.audacityteam.org", "Audacity"),
            bfxr: _link("https://www.bfxr.net", "Bfxr"),
            lmms: _link("https://lmms.io", "LMMS"),
            fontforge: _link("https://fontforge.org/en-US", "FontForge"),
            netbeans: _link("https://netbeans.apache.org", "Netbeans"),
            vscode: _link("https://code.visualstudio.com", "Visual Studio Code"),
            git: _link("https://git-scm.com/", "git"),
            npm: _link("https://www.npmjs.com/", "npm"),
            grunt: _link("https://gruntjs.com/", "Grunt"),
            sass: _link("https://sass-lang.com", "Sass"),
            lazarus: _link("https://www.lazarus-ide.org", "Lazarus"),
            chrome: _link("https://www.google.com/chrome", "Google Chrome"),
            firefox: _link("https://www.mozilla.org/firefox", "Firefox"),
            ubuntu: _link("https://ubuntu.com/desktop", "Ubuntu"),
            elevenlabs: _link("https://elevenlabs.io", "ElevenLabs")
        });
        this._aboutLicenseParagraph.customizeContent({
            license: _link("https://www.gnu.org/licenses/gpl-3.0-standalone.html", "GNU GPLv3"),
            sansation: _link("https://www.dafont.com/sansation.font", "Sansation"),
            aldrich: _link("https://fonts.google.com/specimen/Aldrich", "Aldrich"),
            audiowide: _link("https://fonts.google.com/specimen/Audiowide", "Audiowide"),
            fontlog: _link("assets/fonts/FONTLOG.txt", "fontlog"),
            requireJS: _link("https://requirejs.org", "RequireJS"),
            requireJSLicense: _link("license/RequireJS-License.txt", strings.get(strings.ABOUT.REQUIRE_JS_LICENSE)),
            assetLicense: _link("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0"),
            soundLicense: _link("license/sfx-license.txt", strings.get(strings.ABOUT.HERE)),
            elevenlabs: _link("https://elevenlabs.io", "ElevenLabs"),
            elevenlabsTerms: _link("https://elevenlabs.io/terms-of-use-eu", strings.get(strings.ABOUT.ELEVENLABS_TERMS))
        });
        if (game.usesElectron()) {
            this._aboutLicenseElectronParagraph.customizeContent({
                electron: _link("https://www.electronjs.org", "Electron"),
                electronLicense: _link("https://github.com/electron/electron/blob/main/LICENSE", strings.get(strings.ABOUT.ELECTRON_LICENSE))
            });
            this._aboutLicenseElectronParagraph.show();
        } else {
            this._aboutLicenseElectronParagraph.hide();
        }
        // reversing the order of names if needed based on the current language
        // selecting the names that need to be reversed
        if (strings.getLanguage() === "magyar") {
            reversed = true;
            names = this._container.querySelectorAll(".huName:not(.reversed)");
        } else {
            reversed = false;
            names = this._container.querySelectorAll(".huName.reversed");
        }
        for (i = 0; i < names.length; i++) {
            index = reversed ? names[i].textContent.lastIndexOf(" ") : names[i].textContent.indexOf(" ");
            nameParts = [names[i].textContent.substring(0, index), names[i].textContent.substring(index + 1)];
            names[i].textContent = nameParts[1] + " " + nameParts[0];
            names[i].classList.toggle("reversed");
        }
        // alphabetic ordering of names
        nameLists = this._container.querySelectorAll(".orderedNameList");
        for (i = 0; i < nameLists.length; i++) {
            // convert NodeList to Array
            names = Array.prototype.slice.call(nameLists[i].getElementsByTagName("li"));
            names.sort(_compareNames);
            for (j = 0; j < names.length; j++) {
                nameLists[i].appendChild(names[j]);
            }
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getAboutScreen: function () {
            return new AboutScreen();
        }
    };
});