import {generate} from 'critical';
generate(
  {
    base: "dist/",
    src: "./index.html",
    target: {
        css: 'critical/main.css', // Nome do arquivo CSS crítico
        html: 'critical/index.html', // HTML com CSS crítico embutido
    },
    inline: true,
    dimensions: [
      {
        height: 500,
        width: 300,
      },
      {
        height: 720,
        width: 1280,
      },
    ],
  },
  (err, output) => {
    if (err) {
      console.error(err);
    } else if (output) {
      console.log("Generated critical CSS");
    }
  }
);
