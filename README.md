# Image Annotation

Simple Image Annotator Using SAM2

## Prerequisites

-   Node.js >= 20
-   Python >= 3.10

## Installation

```bash
git clone https://github.com/ItzShubhamDev/Image-Annotation.git
cd Image-Annotation
npm install
python -m venv env
source env/bin/activate ## Or Windows env\Scripts\activate
pip install -r requirements.txt
```

## Running Locally

```bash
npm run dev
```

## Deployment

```bash
npm run build
waitress-serve --host 127.0.0.1 --port 5000 main:app
```

### Other Models

Download any models from [here](https://huggingface.co/models?other=arxiv:2408.00714&sort=trending&search=facebook%2Fsam2-hiera) to models/

And update main.py -> `variant` and `modelPath` according to model name, you can also change device to `gpu` if you have a dedicated GPU.
