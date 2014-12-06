![Logo](http://nkrisztian89.github.io/interstellar-armada/pictures/thumb.png)

Intro
=====

This is the readme file for the *Interstellar Armada* game.
With any questions, turn to the author Krisztián Nagy (<nkrisztian89@gmail.com>).

Interstellar Armada is JavaScript-WebGL based space combat simulator game in the 
early development phase. The core features of the game are still under development.

All parts of the program are licenced under [GNU GPLv3](http://www.gnu.org/licenses/).

Try it out
==========

Though the game is very far from being ready, it is possible to try out the
already implemented features. Just head to [this page]
(http://nkrisztian89.github.io/interstellar-armada/) to launch the game right
from your browser.

I recommend using the latest **Firefox** or **Chrome** for playing the game. I regularly
test on these two browsers, and although modern Internet Explorer, Opera or other
browsers might seem to work, there is a chance that at certain points the game
will produce unexpected behaviour, due to feature differences between browsers.
Also please note that your device / graphics drivers need to support WebGL in 
order to be able to play. It is also possible that the game will only run if
you set lower graphics settings in the menu.

While in the game, you can press `esc` to bring up the in-game menu (according
to default settings), where you can also check the controls.

For developers
==============

I'm using the NetBeans IDE (8.0.1) with its web development (+GLSL) plugins to 
develop this application.

The code is currently in a later phase of a full refactoring process. Next to 
structural and legibility changes, I'm adding comments to all classes, fields and
methods. Many parts are already fully commented. You can generate a HTML 
documentation for the program using [JSDoc](https://github.com/jsdoc3/jsdoc),
although the comments work best viewed directly from the code (due to some limitations
of JSDoc).

It was mainly intended to be a _learning project_ for me to practice and develop
my JavaScript and WebGL skills, therefore I made my design choices based on what
helped me to learn more about these technologies. (hence not using any 3rd party 
WebGL or physics library, etc)

Krisztián Nagy
29.11.2014.