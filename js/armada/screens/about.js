/**
 * Copyright 2014-2016 Krisztián Nagy
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
            ABOUT_AUTHOR_LICENSE_PARAGRAPH_ID = "aboutAuthorLicenseParagraph",
            ABOUT_USED_SOFTWARE_PARAGRAPH_ID = "aboutUsedSoftwareParagraph";
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
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                });
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._versionParagraph = this.registerSimpleComponent(VERSION_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._aboutAuthorLicenseParagraph = this.registerSimpleComponent(ABOUT_AUTHOR_LICENSE_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._aboutUsedSoftwareParagraph = this.registerSimpleComponent(ABOUT_USED_SOFTWARE_PARAGRAPH_ID);

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
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._versionParagraph.customizeContent({version: game.getVersion()});
        this._aboutAuthorLicenseParagraph.customizeContent({
            license: '<a target="_blank" href="http://www.gnu.org/licenses/gpl-3.0-standalone.html">GPLv3</a>',
            github: '<a target="_blank" href="https://github.com/nkrisztian89/interstellar-armada" >github</a>',
            sansation: '<a target="_blank" href="http://www.dafont.com/sansation.font">Sansation</a>',
            requireJS: '<a target="_blank" href="http://requirejs.org/">RequireJS</a>',
            requireJSLicense: '<a target="_blank" href="https://github.com/jrburke/requirejs/blob/master/LICENSE">' + strings.get(strings.ABOUT.REQUIRE_JS_LICENSES) + '</a>'
        });
        this._aboutUsedSoftwareParagraph.customizeContent({
            inkscape: '<a target="_blank" href="https://inkscape.org">Inkscape</a>',
            blender: '<a target="_blank" href="https://www.blender.org/">Blender</a>',
            gimp: '<a target="_blank" href="https://www.gimp.org">GIMP</a>',
            netbeans: '<a target="_blank" href="https://netbeans.org/">Netbeans</a>',
            lazarus: '<a target="_blank" href="http://www.lazarus-ide.org/">Lazarus</a>',
            chrome: '<a target="_blank" href="https://www.google.com/chrome">Google Chrome</a>',
            firefox: '<a target="_blank" href="https://www.mozilla.org/firefox">Firefox</a>',
            ubuntu: '<a target="_blank" href="http://www.ubuntu.com/desktop">Ubuntu</a>'
        });
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        aboutScreen: new AboutScreen()
    };
});