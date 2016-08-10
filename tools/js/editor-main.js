/**
 * Copyright 2016 Krisztián Nagy
 * @file The entry point for the Interstellar Armada editor, to be invoked by RequireJS.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global require */
/**
 * @param editor
 */
require(["editor/editor"], function (editor) {
    "use strict";
    editor.initialize();
});
