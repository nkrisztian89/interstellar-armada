for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        gl_FragColor.rgb += diffuseColor.rgb * u_dirLights[i].color * max(0.0, dot(+u_dirLights[i].direction, normal));
    }
}