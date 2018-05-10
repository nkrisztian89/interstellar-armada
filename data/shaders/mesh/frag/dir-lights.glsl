for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        gl_FragColor.rgb += diffuseColor.rgb * u_dirLights[i].color * max(0.0, dot(+u_dirLights[i].direction.xyz, normal));
        gl_FragColor.rgb += texSpec.rgb * u_dirLights[i].color * ifGreater(shininess, 0.0) * pow(max(dot(normal, normalize(u_dirLights[i].direction.xyz - viewDir)), 0.0), shininess);
    }
}