# Audio Buddy

<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>YT2MP3 - Conversor de Vídeos</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet" />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(145deg, #0b0e1a 0%, #141b2b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: #eef2ff;
        }

        .container {
            max-width: 720px;
            width: 100%;
            background: rgba(22, 30, 50, 0.75);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border-radius: 48px;
            padding: 48px 40px;
            box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.8), inset 0 1px 2px rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.04);
            transition: all 0.2s ease;
        }

        .badge {
            display: inline-block;
            background: rgba(99, 102, 241, 0.18);
            color: #a5b4fc;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 16px;
            border-radius: 100px;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            border: 1px solid rgba(99, 102, 241, 0.2);
            margin-bottom: 20px;
        }

        h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.2;
            margin-bottom: 8px;
            background: linear-gradient(to right, #f0f4ff, #c7d2fe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: #94a3b8;
            font-size: 16px;
            font-weight: 400;
            margin-bottom: 32px;
            border-left: 3px solid #4f46e5;
            padding-left: 16px;
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 28px;
        }

        .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            background: #0f1525;
            border-radius: 60px;
            border: 1px solid #2a3450;
            transition: border 0.2s, box-shadow 0.2s;
            padding: 4px 4px 4px 24px;
        }

        .input-wrapper:focus-within {
            border-color: #6366f1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
        }

        .input-wrapper .icon {
            color: #64748b;
            font-size: 18px;
            margin-right: 12px;
            display: flex;
            align-items: center;
        }

        .input-wrapper input {
            width: 100%;
            background: transparent;
            border: none;
            padding: 16px 0;
            font-size: 15px;
            font-weight: 500;
            color: #f1f5f9;
            outline: none;
            font-family: 'Inter', sans-serif;
        }

        .input-wrapper input::placeholder {
            color: #475569;
            font-weight: 400;
        }

        .input-wrapper button {
            background: #4f46e5;
            border: none;
            color: white;
            font-weight: 700;
            font-size: 15px;
            padding: 12px 28px;
            border-radius: 40px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            font-family: 'Inter', sans-serif;
            letter-spacing: 0.3px;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .input-wrapper button:hover {
            background: #4338ca;
        }

        .input-wrapper button:active {
            transform: scale(0.96);
        }

        .info-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            color: #64748b;
            padding: 0 6px;
            margin-bottom: 32px;
        }

        .info-bar .quality {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .quality span {
            background: #1e293b;
            padding: 4px 14px;
            border-radius: 40px;
            color: #cbd5e1;
            font-weight: 600;
            font-size: 12px;
            border: 1px solid #334155;
        }

        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #2a3450, transparent);
            margin: 12px 0 28px 0;
        }

        .history {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .history-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #0f1525;
            padding: 12px 20px;
            border-radius: 40px;
            border: 1px solid #1e293b;
            transition: background 0.15s;
        }

        .history-item:hover {
            background: #171f33;
            border-color: #2a3450;
        }

        .history-item .file-info {
            display: flex;
            align-items: center;
            gap: 14px;
            overflow: hidden;
        }

        .file-info .thumb {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
            border: 1px solid #2a3450;
        }

        .file-info .details {
            display: flex;
            flex-direction: column;
        }

        .details .title {
            font-weight: 600;
            font-size: 14px;
            color: #e2e8f0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        }

        .details .meta {
            font-size: 12px;
            color: #64748b;
            display: flex;
            gap: 12px;
        }

        .history-item .action-btn {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 20px;
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 30px;
            transition: background 0.2s, color 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .history-item .action-btn:hover {
            background: #1e293b;
            color: #e2e8f0;
        }

        .history-item .action-btn.download {
            color: #818cf8;
        }

        .history-item .action-btn.download:hover {
            background: #1e293b;
            color: #a5b4fc;
        }

        .empty-state {
            text-align: center;
            padding: 32px 8px;
            color: #475569;
        }

        .empty-state .big-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.6;
        }

        .empty-state p {
            font-size: 14px;
            font-weight: 400;
        }

        .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #334155;
            letter-spacing: 0.2px;
        }

        .footer-note a {
            color: #6366f1;
            text-decoration: none;
        }

        @media (max-width: 540px) {
            .container {
                padding: 32px 20px;
                border-radius: 32px;
            }

            .input-wrapper {
                flex-wrap: wrap;
                background: transparent;
                padding: 0;
                border: none;
                gap: 12px;
            }

            .input-wrapper input {
                background: #0f1525;
                padding: 16px 20px;
                border-radius: 60px;
                border: 1px solid #2a3450;
                width: 100%;
            }

            .input-wrapper button {
                width: 100%;
                justify-content: center;
                padding: 16px;
            }

            .input-wrapper .icon {
                display: none;
            }

            .info-bar {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .details .title {
                max-width: 120px;
            }
        }

        /* pequena animação de carregamento (simulada) */
        .loading-dots::after {
            content: '...';
            animation: dots 1.2s steps(4, end) infinite;
        }

        @keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }
    


    


        
        

🎧 conversor de áudio



        

YouTube → MP3


        

Cole o link e converta em segundos



        
        


            


                ▶️
                
                
                    ⬇️ Converter
                
            


        



        
        


            


                🎛️ 320 kbps
                📁 MP3
            


            

🔒 100% seguro


        



        



        
        


            📋 Conversões recentes
            Limpar tudo
        



        


            
            


                

🎵


                

Nenhuma conversão ainda.
Cole um link e comece!


            


        



        


            ⚡ Powered by yt2mp3 · apenas para uso pessoal

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mp3tube.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95c716af-a169-4ebb-bfc9-9c13937eedf7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
