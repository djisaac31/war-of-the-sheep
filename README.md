# War of the Sheep

A cozy browser RTS prototype for Magic Sheep RTS.

## Play Locally

Install Node.js, then run:

```sh
npm start
```

Open:

```txt
http://127.0.0.1:4173/
```

That local link only works on the computer running the server.

## Public Online Multiplayer

To let friends join from anywhere, deploy the project to a real Node web host.
Render is the simplest option for this project:

1. Put this project in a GitHub repository.
2. Go to Render and create a new Web Service.
3. Connect the GitHub repository.
4. Use `npm start` as the start command.
5. Deploy.
6. Share the public Render URL with friends.

The included `render.yaml` already tells Render how to run the server.

## What Multiplayer Does

- Host creates a server-backed room code.
- Friends join the lobby by code.
- The host sees joined players before starting.
- The host starts the match.
- The match shares core commands and battlefield state through `server.js`.

## Important

Do not share a `127.0.0.1` link with friends. That address means “this computer.”
Share the public hosting URL instead, such as:

```txt
https://war-of-the-sheep.onrender.com/
```
