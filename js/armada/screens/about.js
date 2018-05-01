/**
 * Copyright 2014-2018 Krisztián Nagy
 * @file This module manages and provides the About screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, window, document, setInterval, clearInterval */

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
            LICENSE_PARAGRAPH_ID = "licenseParagraph";
    // ------------------------------------------------------------------------------
    // private functions
    function _compareNames(a, b) {
        return a.textContent.localeCompare(b.textContent);
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
        this._versionParagraph.customizeContent({version: game.getVersion()});
        this._aboutGameDevParagraph.customizeContent({
            facebook: '<a target="_blank" href="https://www.facebook.com/interstellar.armada">facebook</a>',
            github: '<a target="_blank" href="https://github.com/nkrisztian89/interstellar-armada">github</a>',
            email: '<a target="_blank" href="mailto:armada.galactic.ace@gmail.com">email</a>'
        });
        this._aboutUsedSoftwareParagraph.customizeContent({
            inkscape: '<a target="_blank" href="https://inkscape.org">Inkscape</a>',
            blender: '<a target="_blank" href="https://www.blender.org/">Blender</a>',
            gimp: '<a target="_blank" href="https://www.gimp.org">GIMP</a>',
            audacity: '<a target="_blank" href="http://www.audacityteam.org">Audacity</a>',
            bfxr: '<a target="_blank" href="http://www.bfxr.net">Bfxr</a>',
            lmms: '<a target="_blank" href="https://lmms.io">LMMS</a>',
            fontforge: '<a target="_blank" href="https://fontforge.github.io/en-US/">FontForge</a>',
            netbeans: '<a target="_blank" href="https://netbeans.org/">Netbeans</a>',
            git: '<a target="_blank" href="https://git-scm.com/">git</a>',
            npm: '<a target="_blank" href="https://www.npmjs.com/">npm</a>',
            grunt: '<a target="_blank" href="https://gruntjs.com/">Grunt</a>',
            sass: '<a target="_blank" href="http://sass-lang.com/">Sass</a>',
            lazarus: '<a target="_blank" href="http://www.lazarus-ide.org/">Lazarus</a>',
            chrome: '<a target="_blank" href="https://www.google.com/chrome">Google Chrome</a>',
            firefox: '<a target="_blank" href="https://www.mozilla.org/firefox">Firefox</a>',
            ubuntu: '<a target="_blank" href="http://www.ubuntu.com/desktop">Ubuntu</a>',
            eslint: '<a target="_blank" href="http://plugins.netbeans.org/plugin/63486/eslint">ESLint</a>',
            glsl: '<a target="_blank" href="http://plugins.netbeans.org/plugin/46515/glsl-syntax-highlighter">GLSL Syntax Highlighter</a>',
            markdown: '<a target="_blank" href="http://plugins.netbeans.org/plugin/50964/markdown-support">Markdown Support</a>'
        });
        this._aboutLicenseParagraph.customizeContent({
            license: '<a target="_blank" href="http://www.gnu.org/licenses/gpl-3.0-standalone.html">GNU GPLv3</a>',
            sansation: '<a target="_blank" href="http://www.dafont.com/sansation.font">Sansation</a>',
            aldrich: '<a target="_blank" href="https://fonts.google.com/specimen/Aldrich">Aldrich</a>',
            audiowide: '<a target="_blank" href="https://fonts.google.com/specimen/Audiowide">Audiowide</a>',
            fontlog: '<a target="_blank" href="fonts/FONTLOG.txt">fontlog</a>',
            requireJS: '<a target="_blank" href="http://requirejs.org/">RequireJS</a>',
            requireJSLicense: '<a target="_blank" href="license/RequireJS-License.txt">' + strings.get(strings.ABOUT.REQUIRE_JS_LICENSE) + '</a>',
            assetLicense: '<a target="_blank" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
            soundLicense: '<a target="_blank" href="license/sfx-license.txt">' + strings.get(strings.ABOUT.HERE) + '</a>'
        });
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
        aboutScreen: new AboutScreen()
    };
});