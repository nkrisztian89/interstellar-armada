![Logo](./assets/images/splash/1.png)

Interstellar Armada: Galactic Ace is a free, Open Source browser-based 3D space 
combat simulator developed in JavaScript-WebGL by Krisztián Nagy (<nkrisztian89@gmail.com>).

It follows in the traditions of old classics like the FreeSpace series with a mission based gameplay
and adds slightly more realism with a Newtonian mechanics based movement system. It has a desktop
focused design, but can be played on mobile devices as well as it supports touchscreen input (next to mouse,
keyboard, joystick and gamepad). It also has a mission editor and an online mission sharing service included.

Play now!
=========

Though the game is not yet fully complete, it is already in a well playable state and its current development
version is released in an "early access" fashion.

## Web version
Just head to **[this page](https://nkrisztian89.github.io/interstellar-armada/)** 
to launch the latest alpha release! **Note:** The perfomance greatly varies depending on the used browser. In my experience,
on most configurations **Chrome/Chromium** provides the best experience (by far).
## Snap version
If you are on Ubuntu or another Linux distribution with snap support, you can install the game from the **[Snap Store](https://snapcraft.io/interstellar-armada)**. This comes with the advantage that you will be able to play offline, as all the resources are included, and the game will automatically be updated to the latest version when I publish a new release.
## Appimage
If you are on Linux but you don't use snaps, you can also download the appimage for the latest **[release](https://github.com/nkrisztian89/interstellar-armada/releases)**. This also allows for offline play, but you will have to manually check here for updates.
## Flatpak
Creating Flatpak builds is a little more complicated, because the build system I use does not support it out of the box, but I plan to add Flatpaks for future releases (from 0.6).
## Windows and Max OS
If you are using these operating systems (or Android, iOS or anything else), just run the web version I linked as the first option, preferably from Chromium or Chrome. Currently I have no plans to add pre-packaged builds for these systems.

# Performance

If you experience performance issues, adjust the level of graphics detail from the menu.
Or if you have a powerful computer, you might want to increase the default settings.
As this is an early version, the performance is subject to changes (and bugs).

For developers
==============

I use [Visual Studio Code](https://code.visualstudio.com/) with the RequireJS Module Support,
ESLint and WebGL GLSL Editor plugins to develop this game. To build the game, you will need
[npm](https://www.npmjs.com/), [Grunt](https://gruntjs.com/) and 
[Sass](https://sass-lang.com/).

After cloning the repository, in its main folder run
```
npm install
grunt build
```
to build the production version of the game. Then serve the game folder with
your favorite server of choice and open `index.html` in the root folder to run
locally. (the game uses XMLHttpRequests, so the file cannot be opened directly
without a server)

Run `grunt clean` to remove the build files.

Run `grunt dev-build` to create a build for development / testing.

Run `grunt watch` while developing to automatically update dev-build files as you modify the sources.

Run `grunt build-with-editor` to create a production build that includes the game editor.

Editor
------

The game includes an editor (also written in JS, in fact it uses modules from the
game itself to load / display game data). You can open it by serving and opening
`editor.html` after making a dev-build or a build-with-editor (see the previous section).
It is also accessible from the game itself under Single player / My missions.
Please note that the editor is even less complete than the game, there are
things that cannot be edited with it (most notably game configuration / settings and
language files), and it has limitations for even the things it can edit (such as not being
able to delete items). It is also fairly buggy.
However, it can still be useful and more comfortable than dealing with the JSON files manually, 
and can be great for understanding how the game data is structured. **To apply the changes
you make** in the editor, you need to **download the game files** to your computer and put them 
in your server's serving folder (or use Electron, as explained in the next chapter), **export 
the files you changed** with the editor (resources/classes/environments/mission), and **overwrite the 
original game files with the exported ones**.

Electron
--------

The game can be run using [Electron](https://www.electronjs.org/). To do this, just 
download a [release](https://github.com/electron/electron/releases) of Electron suitable for 
your computer, make a build of the game (see above), and then copy the project files over to the
appropriate folder of Electron (the `app` folder, which you will have to create within the `resources` folder).
The project contains the necessary files for the Electron setup, so after this it can simply be run by starting the Electron executable.
When run this way, the game has some small differences such as a Quit button in the menu to close the application and the
lack of a fullscreen button (as it will run in fullscreen by default).

The last release of Electron tested with the game: 17.1.2

Snap packaging
--------------

Run `npm run build-snap` after you have created a game build to use [electron-builder](https://www.electron.build/) to package the build
together with Electron into a [Snap](https://snapcraft.io/). The package file and other build artifacts will be generated in the `dist` folder.

To clean the folder up, run `npm run clean-snap`.

Appimage packaging
------------------

The same goes as for snaps, just use `npm run build-appimage` instead.

Latest versions tested:

Electron: 26.1.0

electron-builder: 24.6.3

License and copyright
=====================

Please see the LICENSE.txt file or the About page within the game for the details of licensing.
In short, most of the source code of the game is released under the [GNU GPLv3](http://www.gnu.org/licenses/gpl-3.0-standalone.html) license
and most of the assets are released under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license, but for exceptions,
details and attributions please do check LICENSE.txt.

With game related questions, suggestions and feedback please contact me at
<armada.galactic.ace@gmail.com>.

Krisztián Nagy

02.09.2023.