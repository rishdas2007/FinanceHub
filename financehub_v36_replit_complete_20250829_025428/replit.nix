{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.postgresql
    pkgs.nodePackages.typescript
    pkgs.nodePackages.ts-node
  ];
}
