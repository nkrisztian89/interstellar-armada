![Logo](http://nkrisztian89.github.io/interstellar-armada/images/splash/1.png)

Interstellar Armada: Galactic Ace is a free, Open Source browser-based 3D space 
combat simulator developed in JavaScript-WebGL by Krisztián Nagy (<nkrisztian89@gmail.com>).

Play now!
=========

Though the game is far from being ready, it is possible to try out what has already
been completed from it. **Just head to [this page](http://nkrisztian89.github.io/interstellar-armada/) 
to launch the latest alpha release right in your browser.**

If you experience performance issues, adjust the level of graphics detail from the menu.
Or if you have a powerful computer, you might want to increase the default settings.
As this is an early version, the performance is subject to changes (and bugs).
The perfomance also greatly varies depending on the used browser. In my experience,
on most configurations **Chrome** provides the best experience.

With game related questions, suggestions and feedback please contact me at
<armada.galactic.ace@gmail.com>.

For developers
==============

I use [NetBeans](https://netbeans.org/) (8.2) with its web development (+
[ESLint](http://plugins.netbeans.org/plugin/63486/eslint),
[GLSL](http://plugins.netbeans.org/plugin/46515/glsl-syntax-highlighter) and 
[Markdown](http://plugins.netbeans.org/plugin/50964/markdown-support)) plugins 
to develop this game. For the (very rudimentary) build process, you will need
[npm](https://www.npmjs.com/) and [Grunt](https://gruntjs.com/). After
installing the dev dependencies with `npm install`, running `grunt build`
creates a concatenated, minified (and somewhat optimized) source and changes 
the reference to it in `index.html`. Use `grunt clean` to remove the built
file and change back the reference to the regular source.

Editor
------

The game includes an editor (also written in JS, in fact it uses modules from the
game itself to load / display game data). It can be found in the tools folder.
Please note that the editor is even less complete than the game, there are
things that cannot be edited with it (most notably game configuration / settings and
missions), and it has limitations for even the things it can edit (such as not being
able to delete optional properties or delete items themselves). It is also fairly buggy.
However, it can still be useful and more comfortable than dealing with the JSON files manually, 
and can be great for understanding how the game data is structured. **To apply the changes
you make** in the editor, you need to **download the game files** to your computer and put them 
in your server's serving folder (or use Electron, as explained in the next chapter), **export 
the files you changed** with the editor (resources/classes/environments), and **overwrite the 
original game files with the exported ones**.

Electron
--------

The game can be run using [Electron](https://electron.atom.io/). To do this, 
search for "electron" in the source code (`js` folder) and comment/uncomment the
indicated parts of the code according to the instructions you find. For non-development
versions (which don't have "-dev" in the version number), you will also need to run
``
npm install
grunt clean
grunt build
``
in the project folder after changing the source code.
Then download a [release](https://github.com/electron/electron/releases) of Electron suitable for 
your computer and copy the project files over to its appropriate folder (the `app` folder,
which you will have to create within the `resources` folder). The project contains the necessary
files for the Electron setup, so after this it can simply be run by starting the Electron executable.

Snap packaging
--------------

I have added added the files necessary to create a [snap package](https://snapcraft.io/) out of the game 
in the snap folder. I used Electron to create a standalone version of the app and then packaged it with snapcraft.
Everything was working in my tests except the sound. (which might be due to bad configuration or the limitations
of snap at the time I tried)

License and copyright
=====================

Please see the LICENSE.txt file or the About page within the game for the details of licensing.
In short, most of the source code of the game is released under the [GNU GPLv3](http://www.gnu.org/licenses/gpl-3.0-standalone.html) license
and most of the assets are released under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license, but for exceptions,
details and attributions please do check LICENSE.txt.

Krisztián Nagy

19.03.2017.