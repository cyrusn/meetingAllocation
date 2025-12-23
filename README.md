# Meeting Allocation

## Caddy server

```sh
cd ./out
caddy file-server --listen :8080
```

## Generate JSON file

```
node main.js
```

## Preparation for the JSON files

```js
// locations.json

["G10", "Rm302", "Rm303", "Rm304"];
```

```js
// meeetings.json
[
  {
    name: "",
    cname: "",
    pics: [],
    members: [],
    duration: 1.25,
    location: "",
    remark: "",
  },
]
```

```js
//  example for orders.json
[
  "Learning Across Curriculum Meeting",
  "Curriculum Planning in STEAM Education",
  "STEAM Education Coordination Team",
  "Curriculum Development Team",
  "KLA - Science and Laboratory Safety Team",
]
```
