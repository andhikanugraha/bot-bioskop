# bot-bioskop

A bot for browsing Indonesian cinema chains.

## Developing locally on Windows

If you’re running Windows you can use the [Bot Framework Emulator](/en-us/tools/bot-framework-emulator/) to locally test your changes and verify you have everything properly configured prior to deploying your bot. Make sure you set the App ID & Password within the emulator to match your bots configured App ID & Password.

## Debugging locally using ngrok

If you’re running on a Mac and can’t use the emulator, or you just want to debug an issue you’re seeing when deployed, you can easily configure your bot to run locally using [ngrok](https://ngrok.com/). First install ngrok and then from a console window type:

    ngrok http 3978

This will configure an ngrok forwarding link that forwards requests to your bot running on port 3978. You'll then need to set the forwarding link to be the registered endpoint for your bot within the Bot Framework developer portal. The endpoint should look something 
like `https://0d6c4024.ngrok.io/api/messages` once configured. Just don't forget to include the `/api/messages` at the end of the link.

You're now ready to start your bot in debug mode. If you're using [VSCode](https://code.visualstudio.com) you'll need to configure your launch `env` with your bots App ID & Password: 

{% highlight JavaScript %}
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch",
            "type": "node",
            "request": "launch",
            "program": "${workspaceRoot}/app.js",
            "stopOnEntry": false,
            "args": [],
            "cwd": "${workspaceRoot}",
            "preLaunchTask": null,
            "runtimeExecutable": null,
            "runtimeArgs": [
                "--nolazy"
            ],
            "env": {
                "NODE_ENV": "development",
                "MICROSOFT_APP_ID": "Your bot's App ID",
                "MICROSOFT_APP_PASSWORD": "Your bot's Password"
            },
            "externalConsole": false,
            "sourceMaps": false,
            "outDir": null
        },   
{% endhighlight %}
