---
type: Added
title: A progress bar while a new mountain is built
---

Building a new mountain takes from a few seconds to half a minute, and the game now shows how far it has got. The generator reports its progress as it raises the mountain, walks and grades the runs, grows the woods and checks the map, and the loading card's bar follows it. The map is now built off the page's main thread, so the card keeps drawing while it works. The free ride's start card shows the same bar over the chart while the next mountain is raised. When a mountain is turned down and another is tried, the bar slows down but never moves backwards.
