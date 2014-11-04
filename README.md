Intro
=====

This is the readme file for the Interstellar Armada (working name) program.
With any questions, turn to the author Krisztián Nagy <nkrisztian89@gmail.com>.

Interstellar Armada is JavaScript-WebGL based space combat simulator game in the 
early development phase. The core features of the game are still under development.

How to start?
=============

Though the game is very far from being ready, it is possible to try out the
already implemented features. All commits to this github repository go through
some basic testing to make sure the application runs and at least the basic
features do work (at least on the test configuration).

To try out the game from your own computer, you will need to have a web server 
installed and running, as currently the game does not support being run directly
from the local filesystem. This shouldn't be a big issue as many lightweight, 
free and easy to set up servers are available nowadays. After you have set up
the server, just put the game folder (e.g. named 'armada') into the page serving
folder of the server, then type "localhost/armada" in your browser's address bar 
to start.

I recommend using the latest Firefox or Chrome for playing the game. I regularly
test on these two browser, and although modern Internet Explorer, Opera or other
browsers might seem to work, there is a chance that at certain points the game
will produce unexpected behaviour, due to feature differences between browsers.
Also please note that your device / graphics drivers need to support WebGL in 
order to be able to play.

The game uses realistic (simplified, newtonian) physics simulating a deep space
environment (no gravitational forces in effect). While piloting a spacecraft,
you can turn on _"compensated mode"_ to aid maneuvering. In this mode the computer 
will automatically fire your thrusters to compensate for sideways drift (resulting 
from inertia) as well as to get the craft up to the set speed in the current 
direction it is heading as you turn. Check the control settings to see how you
can activate this mode.

For developers
==============

I'm using the NetBeans IDE (8.0.1) with its web development (+GLSL) plugins to 
develop this application.

The code is currently in a later phase a full refactoring process. Next to 
structural and legibility changes, I'm adding comments to all classes, fields and
methods. Many part are already fully commented. You can generate a HTML 
documentation for the program using the [JSDoc](https://github.com/jsdoc3/jsdoc).

It was mainly intended to be a _learning project_ for me to practice and develop
my JavaScript and WebGL skills, therefore I made my design choices based on what
helped me to learn more about the fundaments and particulars of these 
technologies. (hence not using any 3rd party WebGL or physics library, etc)

Krisztián Nagy
03.11.2014.