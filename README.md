# PatchBay

<img src="PatchBay-logo.png" alt="PatchBay Logo" width="250">

PatchBay is a dead-simple modular + declarative web framework built for Bun. PatchBay is somewhat opinionated to make
it as simple and plug-n-play as possible; but generally pretty flexible if you're okay getting your hands dirty.

PatchBay is named after the audio patch bays you find in music studios and on stages. Much like connecting cables on
an audio patch bay, to use PatchBay you will be simply declaring how to route requests around, abstracting logic into
individual `Patch`es and using `Router`s for control flow.

Just like Bun itself, PatchBay is in infancy – but as Bun grows, so too will PatchBay.

---

## Documentation

For now, docs are hosted on the [GitHub Wiki](https://github.com/harryrabin/bun-patchbay/wiki).

## Installation

In most cases, you'll want to start with the default project. To do this, run:
```shell
bun create harryrabin/new-patchbay-project destination-folder
```
All documentation assumes you're using the default project. Programmatic usage of PatchBay is currently not
recommended (but is certainly possible, and I've included info on that).

If you want to use PatchBay programmatically (see [Programmatic Usage](https://github.com/harryrabin/bun-patchbay/wiki/Programmatic-Usage-(Advanced))),
just run:
```shell
bun add bun-patchbay
```
to add it to your existing package as a dependency.
