# Image Annotation
Simple Image Annotator Using SAM2

## Running Locally 

### Client 

```bash
cd Client
npm install
npm run dev
```
### Server 

Download model from [here](https://huggingface.co/facebook/sam2-hiera-tiny) to Server/models/

```bash
cd Server
pip install -r requirements.txt
python main.py
```
    
## Deployment

Client

```bash
cd Client
npm run build
```

Copy all contents of `dist` in `Client` to `static` in `Server`

Deploy flask [guide](https://flask.palletsprojects.com/en/stable/deploying/)

### Other Models

Download any models from [here](https://huggingface.co/models?other=arxiv:2408.00714&sort=trending&search=facebook%2Fsam2-hiera) to Server/models/

And update main.py -> `variant` and `ckpt_path` according to model name, you can also change device to `gpu` if you have a dedicated GPU.
