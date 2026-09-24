# Ultimate Shaolin Football — navegador

Abrí index.html para jugar contra la IA o en 1v1 local. Three.js r128 y PeerJS 1.5.4 están incluidos en vendor; las tipografías web tienen fuentes de respaldo. No hace falta instalar dependencias para jugar. Para las pruebas y WebRTC, serví esta carpeta con un servidor local (por ejemplo, Live Server del editor) y abrí su dirección HTTP.

## Cambios

- Gradas de cabecera orientadas hacia afuera; el techo del lado de cámara ya no oculta el campo. Porterías con postes y redes transparentes.
- Cuatro cámaras: Completa, TV, Comentarista baja y Jugador en tercera persona. Botón o tecla C para alternar; encuadre adaptable a pantallas horizontales y verticales.
- Un único jugador recibe cada control. Los compañeros mantienen formación, ofrecen pases y presionan con el más cercano; el arquero permanece en su zona.
- Posesión explícita, recepción e intercepción, bloqueo de recaptura tras patear, pases dirigidos y disparos con carga. Selección automática del receptor y separación física entre jugadores.
- Arquero con recogida y desvíos por contacto; decisiones y acciones sincronizadas con la simulación, sin temporizadores de disparos que sobrevivan a la pausa.
- Saques de banda, meta y córner según el último toque; ejecutante asignado y reanudación automática. Penales únicamente por faltas en el área propia del defensor. Fuera de juego según dirección y penúltimo defensor.
- Gol cuando la pelota cruza completamente la línea entre los postes y bajo el travesaño. No se concede al entrar por detrás. Rebotes en postes y travesaño.
- Dos tiempos de 45 minutos, reloj acelerado (6 minutos de juego activo), descanso con cambio de campo, recuperación parcial de energía y final del partido.
- Repeticiones omitibles; pausa al perder foco; reinicio limpio de sanciones, expulsiones, entradas y repeticiones.
- HUD adaptable, selección visible, controles táctiles con botón de cambio, entradas de mando por pulsación y separación de teclados en local.

## Controles

| Acción | Jugador 1 | Jugador 2 local |
| --- | --- | --- |
| Mover | WASD (flechas también contra IA) | Flechas |
| Pase / entrada defensiva | K o clic en cancha | Num 1 |
| Cargar y soltar tiro | J | Num 2 |
| Pase filtrado | L | Num 3 |
| Entrada | E | Num 0 |
| Sprint | Shift izquierdo | Shift derecho |
| Cambiar jugador | Q o espacio | Enter |
| Pausa | Esc o P | Esc o P |

Mandos estándar: stick para mover, A pase, X tiro, Y filtrado, B entrada, LB cambio, RT sprint, Start pausa. Cada mando corresponde a su jugador. En móvil aparecen joystick y botones.

## Verificación

Abrí tests/index.html desde el servidor y pulsá Ejecutar pruebas. La batería de 31 pruebas comprueba control individual, eventos por pulsación, teclado local, pases y recepción, tackles, arquero, goles y postes, saques, fuera de juego, penales, pausa, descanso, final, reinicio y encuadre en tres tamaños.

También se probó en Chrome una simulación de 20.000 pasos con los dos equipos controlados por IA, sin posiciones inválidas ni bloqueos. Se verificó además una conexión WebRTC real entre dos páginas de Chrome: movimiento del invitado, marcador de gol y reinicio sincronizados. La conexión entre dispositivos/redes diferentes y los mandos/táctil físicos todavía requieren pruebas en esos dispositivos.

## Alcance y próximas mejoras

Es un juego arcade 3D, no una reproducción completa de FIFA. Los saques y penales se ejecutan automáticamente; el fuera de juego se sanciona al seleccionar un receptor adelantado. No incluye ventaja, sustituciones, lesiones, cabezazos ni todas las excepciones arbitrales.

Próximas mejoras sugeridas: balón parado manual, dificultad configurable, editor de formaciones, animaciones de cabezazo y controles configurables. Para ampliar el multijugador: servidor de señalización propio y pruebas de latencia/desconexión entre dispositivos. El modo P2P actual necesita Internet para señalización y STUN aunque ambos equipos estén en una LAN.

## Cuatro cámaras y cambio contextual

C o el botón CÁMARA recorren Completa → TV → Comentarista → Jugador.

- Comentarista: perspectiva baja desde la banda, paneo hacia la pelota y zoom según distancia.
- Jugador: seguimiento en tercera persona del seleccionado, distancia adaptable a la velocidad y a la separación del balón; transición suave al cambiar de jugador. Conserva la orientación de ataque, sin girar bruscamente con cada giro del cuerpo.
- En las vistas en perspectiva, las direcciones del teclado, stick y joystick corresponden a la pantalla. En local ambos jugadores comparten la vista de P1; el invitado LAN sigue a su P2.
- Q, espacio, LB o CAMBIO priorizan al compañero capaz de llegar a la jugada. Si mantenés una dirección, seleccionan a un compañero hacia ese lado. El anillo dorado y la tarjeta indican la siguiente selección.
- La selección considera la trayectoria del balón y evita jugadores expulsados, caídos o haciendo una entrada. El arquero queda fuera del cambio habitual.
- El receptor obtiene el control durante el pase y al recibir. Una selección manual tiene prioridad y un breve bloqueo evita cambios automáticos inmediatos no deseados.

Las pulsaciones breves de teclado y botones táctiles se conservan hasta el siguiente fotograma para evitar perder cambios rápidos de jugador.
