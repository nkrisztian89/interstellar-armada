for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        gl_FragColor.rgb += diffuseColor.rgb * u_dirLights[i].color * max(0.0, dot(+u_dirLights[i].direction, normal));
        gl_FragColor.rgb += texSpec.rgb * u_dirLights[i].color * (v_shininess > 0.0 ? pow(max(dot(reflDir, u_dirLights[i].direction), 0.0), v_shininess) : 0.0);
    }
}