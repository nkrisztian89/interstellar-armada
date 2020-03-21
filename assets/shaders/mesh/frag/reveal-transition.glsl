    // add a u_revealTransitionLength long transition from white to the calculated color from the start of reveal
    if ((u_revealFront == true) && (v_modelPos.y <= u_revealStart + u_revealTransitionLength)) {
        float factor = (v_modelPos.y - u_revealStart) / u_revealTransitionLength;
        color = mix(u_revealColor, color, factor);
    } else
    if ((u_revealFront == false) && (v_modelPos.y >= u_revealStart - u_revealTransitionLength)) {
        float factor = (u_revealStart - v_modelPos.y) / u_revealTransitionLength;
        color = mix(u_revealColor, color, factor);
    }

    gl_FragColor = color;
}