gl_FragColor.rgb = diffuseColor.rgb * u_dirLights[0].color * max(0.0, dot(+u_dirLights[0].direction, normal));