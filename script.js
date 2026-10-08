
/* ==================================================
   リアルタイム時刻
================================================== */

/*
   スマートフォンやパソコンの
   現在時刻を取得する。

   1秒ごとに更新するので、

   11:31
   ↓
   11:32
   ↓
   11:33

   のように自動的に変わる。
*/

function updateCurrentTime(){

    const now =
        new Date();


    const hours =
        String(
            now.getHours()
        ).padStart(2,"0");


    const minutes =
        String(
            now.getMinutes()
        ).padStart(2,"0");


    const time =
        hours +
        ":" +
        minutes;


    document
        .querySelectorAll(
            ".current-time"
        )
        .forEach(function(element){

            element.textContent =
                time;

        });

}


/*
   最初にすぐ表示
*/

updateCurrentTime();


/*
   1秒ごとに更新
*/

setInterval(
    updateCurrentTime,
    1000
);


/* ==================================================
   データ
================================================== */

// ==================================================
// AI設定（OpenRouter）
// ==================================================
// ここに自分のOpenRouter APIキーを入れてください。
const OPENROUTER_API_KEY = "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";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

async function callOpenRouter(messages){
    if(!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "APIキーをここに貼り付け"){
        throw new Error("OpenRouter APIキーが設定されていません。コード上部のOPENROUTER_API_KEYに貼り付けてください。");
    }

    const response = await fetch(OPENROUTER_ENDPOINT,{
        method:"POST",
        headers:{
            "Authorization":"Bearer " + OPENROUTER_API_KEY,
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            model:OPENROUTER_MODEL,
            temperature:0.7,
            messages:messages
        })
    });

    const data = await response.json();
    if(!response.ok){
        throw new Error(data?.error?.message || ("APIエラー HTTP " + response.status));
    }

    const content = data?.choices?.[0]?.message?.content;
    if(!content){
        throw new Error("AIから回答が返ってきませんでした。");
    }
    return content.trim();
}

async function generateAITopic(){
    const text = await callOpenRouter([
        {role:"system",content:"あなたは日本語のなぞかけのお題を作るAIです。"},
        {role:"user",content:"日本の専門学校生でも考えやすく、面白いなぞかけのお題を1つだけ作ってください。説明や答えは不要です。30文字以内で、お題の言葉だけを返してください。なぞかけなので○○とかけましての○○部分だけでいいです"}
    ]);
    return text.replace(/^「|」$/g,"").trim();
}

async function scoreWithAI(topic, first, second){
    const resultText = await callOpenRouter([
        {role:"system",content:"あなたは日本語のなぞかけを公平に採点するAIです。必ずJSONだけを返してください。形式は {\"score\":数字,\"comment\":\"短い日本語コメント\"} です。scoreは0から100の整数です。"},
        {role:"user",content:"次のなぞかけを採点してください。\n\nお題："+topic+"\nと説く："+first+"\nその心は："+second+"\n\n評価は、お題との関連性30点、なぞかけとしての成立度30点、発想力20点、面白さ20点を目安にしてください。コメントは2～4文程度で書いてください。"}
    ]);

    let parsed;
    try{
        const jsonMatch=resultText.match(/\{[\s\S]*\}/);
        parsed=JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    }catch(e){
        const scoreMatch=resultText.match(/\b(100|[1-9]?\d)\b/);
        parsed={score:scoreMatch?Number(scoreMatch[1]):0,comment:resultText};
    }

    let score=Number(parsed.score);
    if(!Number.isFinite(score)) score=0;
    score=Math.max(0,Math.min(100,Math.round(score)));
    return {score:score,comment:parsed.comment || "AIからコメントが返ってきませんでした。"};
}

const questions = [

    "学校",

    "スマホ",

    "猫",

    "ゲーム",

    "コンビニ",

    "夏休み",

    "雨",

    "宇宙",

    "スポーツ",

    "ラーメン",

    "海",

    "映画",

    "時計",

    "料理",

    "旅行",

    "犬",

    "音楽",

    "朝",

    "お祭り",

    "宿題"

];


let soloQuestion = "";


let selectedIcon =
    localStorage.getItem(
        "nazokakeIcon"
    ) || "01";


let playerName =
    localStorage.getItem(
        "nazokakePlayer"
    ) || "プレイヤー名";


let currentRoom = null;


let friendTimer = null;


let soloTimer = null;


let soloTimeLeft = 90;


let friendTimeLeft = 90;


/* ==================================================
   画面切り替え
================================================== */

function show(id){

    if(soloTimer){

        clearInterval(
            soloTimer
        );

        soloTimer = null;

    }


    if(friendTimer){

        clearInterval(
            friendTimer
        );

        friendTimer = null;

    }


    document
        .querySelectorAll(".screen")
        .forEach(function(screen){

            screen.classList.remove(
                "active"
            );

        });


    const target =
        document.getElementById(id);


    if(target){

        target.classList.add(
            "active"
        );

    }


    window.scrollTo(
        0,
        0
    );


    /*
       画面を切り替えたときも
       現在時刻をすぐ反映
    */

    updateCurrentTime();

    /*
       画面操作はユーザー操作として扱われることが多いため、
       BGM再生をここでも試す。
    */
    if(bgmEnabled){
        startBGM();
    }

}


/* ==================================================
   トースト
================================================== */

function showToast(message){

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(function(){

        toast.classList.remove(
            "show"
        );

    },1800);

}


/* ==================================================
   ランダムお題
================================================== */

function pickQuestion(){

    return questions[
        Math.floor(
            Math.random() *
            questions.length
        )
    ];

}


/* ==================================================
   一人用開始
================================================== */

function startSolo(){

    soloQuestion = "";

    document.getElementById("soloQuestion").textContent = "AIがお題を考えています…";
    document.getElementById("soloFirstAnswer").value = "";
    document.getElementById("soloSecondAnswer").value = "";
    document.getElementById("soloAIError").style.display = "none";

    show("solo");
    startSoloTimer();

    generateAITopic().then(function(topic){
        soloQuestion = topic;
        document.getElementById("soloQuestion").textContent = "「" + topic + "」とかけまして";
    }).catch(function(error){
        document.getElementById("soloQuestion").textContent = "お題の生成に失敗しました";
        const el=document.getElementById("soloAIError");
        el.textContent="AIお題生成エラー：\n"+error.message;
        el.style.display="block";
    });

}



/* ==================================================
   一人用90秒カウントダウン
================================================== */

function startSoloTimer(){

    if(soloTimer){

        clearInterval(
            soloTimer
        );

    }


    soloTimeLeft = 90;


    const timer =
        document.getElementById(
            "soloTimer"
        );


    timer.textContent =
        "残り時間：90秒";

    timer.classList.remove(
        "warning"
    );


    soloTimer =
        setInterval(function(){

            soloTimeLeft--;


            timer.textContent =
                "残り時間：" +
                soloTimeLeft +
                "秒";


            if(soloTimeLeft <= 10){

                timer.classList.add(
                    "warning"
                );

            }


            if(soloTimeLeft <= 0){

                clearInterval(
                    soloTimer
                );

                soloTimer = null;

                submitSolo(true);

            }

        },1000);

}



/* ==================================================
   一人用回答
================================================== */

async function submitSolo(auto){

    if(auto === undefined){ auto = false; }

    if(soloTimer){ clearInterval(soloTimer); soloTimer=null; }

    const first = document.getElementById("soloFirstAnswer").value.trim();
    const second = document.getElementById("soloSecondAnswer").value.trim();
    const errorEl = document.getElementById("soloAIError");
    errorEl.style.display="none";

    if(!soloQuestion){
        showToast("AIがお題を作成中です。少し待ってください。");
        startSoloTimer();
        return;
    }

    if((!first || !second) && !auto){
        showToast("2か所とも入力してください");
        startSoloTimer();
        return;
    }

    const finalFirst = first || "時間切れ";
    const finalSecond = second || "回答なし";

    show("soloAI");

    try{
        const result = await scoreWithAI(soloQuestion,finalFirst,finalSecond);

        document.getElementById("soloScore").textContent = result.score + "点";
        document.getElementById("soloResultAnswer").textContent =
            "「" + soloQuestion + "」とかけまして\n" +
            "「" + finalFirst + "」とときます\n" +
            "その心は？ " + finalSecond;
        document.getElementById("soloComment").textContent = result.comment;
        show("soloResult");
    }catch(error){
        show("solo");
        errorEl.textContent="AI採点エラー：\n"+error.message;
        errorEl.style.display="block";
        startSoloTimer();
    }
}



/* ==================================================
   部屋作成
================================================== */

function createRoom(){

    const name =
        document.getElementById(
            "roomName"
        ).value.trim();


    const password =
        document.getElementById(
            "roomPassword"
        ).value.trim();


    const time =
        Number(
            document.getElementById(
                "roomTime"
            ).value
        );


    const rounds =
        Number(
            document.getElementById(
                "roomRounds"
            ).value
        );


    if(!name){

        showToast(
            "部屋名を入力してください"
        );

        return;

    }


    currentRoom = {

        name:name,

        password:password,

        time:time,

        rounds:rounds

    };


    document.getElementById(
        "lobbyName"
    ).textContent =
        name;


    document.getElementById(
        "lobbyP1"
    ).textContent =
        playerName;


    show(
        "lobby"
    );

}


/* ==================================================
   部屋検索
================================================== */

function joinRoom(){

    const id =
        document.getElementById(
            "joinId"
        ).value.trim();


    if(!id){

        showToast(
            "部屋IDを入力してください"
        );

        return;

    }


    currentRoom = {

        name:
            "部屋 " +
            id,

        time:90,

        rounds:3

    };


    document.getElementById(
        "lobbyName"
    ).textContent =
        currentRoom.name;


    document.getElementById(
        "lobbyP1"
    ).textContent =
        playerName;


    show(
        "lobby"
    );

}


/* ==================================================
   マルチゲーム開始
================================================== */

function startMultiGame(){

    if(!currentRoom){

        currentRoom = {

            name:"テストルーム",

            time:90,

            rounds:3

        };

    }


    const question =
        pickQuestion();


    document.getElementById(
        "friendQuestion"
    ).textContent =
        "お題：" +
        question;


    document.getElementById(
        "friendAnswer"
    ).value =
        "";


    friendTimeLeft =
        currentRoom.time ||
        90;


    document.getElementById(
        "friendTime"
    ).textContent =
        friendTimeLeft +
        "秒";


    show(
        "multiGame"
    );


    startFriendTimer();

}


/* ==================================================
   マルチタイマー
================================================== */

function startFriendTimer(){

    if(friendTimer){

        clearInterval(
            friendTimer
        );

    }


    friendTimer =
        setInterval(function(){

            friendTimeLeft--;


            document.getElementById(
                "friendTime"
            ).textContent =
                friendTimeLeft +
                "秒";


            if(
                friendTimeLeft <= 0
            ){

                clearInterval(
                    friendTimer
                );

                friendTimer =
                    null;


                submitMulti(
                    true
                );

            }

        },1000);

}


/* ==================================================
   マルチ回答
================================================== */

function submitMulti(auto){

    if(auto === undefined){

        auto = false;

    }


    if(friendTimer){

        clearInterval(
            friendTimer
        );

        friendTimer =
            null;

    }


    const answer =
        document.getElementById(
            "friendAnswer"
        ).value.trim();


    if(
        !answer &&
        !auto
    ){

        showToast(
            "答えを入力してください"
        );


        startFriendTimer();


        return;

    }


    show(
        "multiAI"
    );


    setTimeout(function(){

        const myScore =
            700 +
            Math.floor(
                Math.random() *
                301
            );


        const secondScore =
            650 +
            Math.floor(
                Math.random() *
                301
            );


        const thirdScore =
            600 +
            Math.floor(
                Math.random() *
                301
            );


        const fourthScore =
            550 +
            Math.floor(
                Math.random() *
                301
            );


        document.getElementById(
            "resultPlayer"
        ).textContent =
            playerName;


        document.getElementById(
            "friendTotal"
        ).textContent =
            myScore;


        const list =
            document.getElementById(
                "friendResultList"
            );


        list.innerHTML =
            "";


        addResultRow(
            list,
            "1位",
            playerName,
            myScore
        );


        addResultRow(
            list,
            "2位",
            "プレイヤー2",
            secondScore
        );


        addResultRow(
            list,
            "3位",
            "プレイヤー3",
            thirdScore
        );


        addResultRow(
            list,
            "4位",
            "プレイヤー4",
            fourthScore
        );


        show(
            "multiResult"
        );


    },1800);

}


/* ==================================================
   結果行
================================================== */

function addResultRow(
    parent,
    rank,
    name,
    score
){

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "friend-result-item";


    row.innerHTML =

        "<span>" +
        rank +
        "</span>" +

        "<div class='icon-small'>" +
        "アイコン" +
        "</div>" +

        "<span>" +
        name +
        "</span>" +

        "<div class='line'></div>" +

        "<b>" +
        score +
        "点" +
        "</b>";


    parent.appendChild(
        row
    );

}


/* ==================================================
   プレイヤー名変更
================================================== */

function changePlayerName(){

    const newName =
        prompt(
            "プレイヤー名を入力してください",
            playerName
        );


    if(!newName){

        return;

    }


    playerName =
        newName.trim();


    if(!playerName){

        return;

    }


    localStorage.setItem(
        "nazokakePlayer",
        playerName
    );


    updateProfile();


    showToast(
        "プレイヤー名を変更しました"
    );

}


/* ==================================================
   アイコン選択
================================================== */

function selectIcon(
    element,
    icon
){

    document
        .querySelectorAll(
            ".icon-choice"
        )
        .forEach(function(btn){

            btn.classList.remove(
                "selected"
            );

        });


    element.classList.add(
        "selected"
    );


    selectedIcon =
        icon;

}


/* ==================================================
   アイコン保存
================================================== */

function saveIcon(){

    localStorage.setItem(
        "nazokakeIcon",
        selectedIcon
    );


    updateProfile();


    showToast(
        "アイコンを変更しました"
    );


    setTimeout(function(){

        show(
            "profile"
        );

    },500);

}


/* ==================================================
   プロフィール反映
================================================== */

function updateProfile(){

    document.getElementById(
        "homePlayer"
    ).textContent =
        playerName;


    document.getElementById(
        "lobbyP1"
    ).textContent =
        playerName;


    document.getElementById(
        "resultPlayer"
    ).textContent =
        playerName;

}


/* ==================================================
   BGM設定
================================================== */

const bgmAudio = document.getElementById("bgmAudio");

let bgmEnabled =
    localStorage.getItem("nazokakeBgmEnabled") !== "false";

let bgmVolume =
    Number(
        localStorage.getItem("nazokakeBgmVolume") || "70"
    );

let seEnabled =
    localStorage.getItem("nazokakeSeEnabled") !== "false";

let voiceEnabled =
    localStorage.getItem("nazokakeVoiceEnabled") !== "false";


function applyBGMSettings(){

    if(!bgmAudio){
        return;
    }

    bgmAudio.volume =
        Math.max(
            0,
            Math.min(
                1,
                bgmVolume / 100
            )
        );

    updateBGMControls();

}


function startBGM(){

    if(!bgmAudio || !bgmEnabled){
        return;
    }

    /*
       スマホでは自動再生が制限されるため、
       ユーザーがボタンを押したタイミングで再生を試みる。
    */
    bgmAudio.play().catch(function(){

        /* 音源がまだ無い場合などは何もしない */

    });

}


function stopBGM(){

    if(!bgmAudio){
        return;
    }

    bgmAudio.pause();

}


function toggleBGM(){

    bgmEnabled =
        !bgmEnabled;

    localStorage.setItem(
        "nazokakeBgmEnabled",
        bgmEnabled
    );

    if(bgmEnabled){

        applyBGMSettings();
        startBGM();

    }
    else{

        stopBGM();

    }

    updateBGMControls();

}


function changeBGMVolume(value){

    bgmVolume =
        Number(value);

    localStorage.setItem(
        "nazokakeBgmVolume",
        bgmVolume
    );

    if(bgmAudio){

        bgmAudio.volume =
            bgmVolume / 100;

    }

    updateBGMControls();

}


function toggleSE(){

    seEnabled =
        !seEnabled;

    localStorage.setItem(
        "nazokakeSeEnabled",
        seEnabled
    );

    updateBGMControls();

}


function toggleVoice(){

    voiceEnabled =
        !voiceEnabled;

    localStorage.setItem(
        "nazokakeVoiceEnabled",
        voiceEnabled
    );

    updateBGMControls();

}


function updateBGMControls(){

    const bgmToggle =
        document.getElementById(
            "bgmToggle"
        );

    const bgmRange =
        document.getElementById(
            "bgmVolume"
        );

    const bgmValue =
        document.getElementById(
            "bgmVolumeValue"
        );

    const seToggle =
        document.getElementById(
            "seToggle"
        );

    const voiceToggle =
        document.getElementById(
            "voiceToggle"
        );


    if(bgmToggle){

        bgmToggle.textContent =
            bgmEnabled ? "ON" : "OFF";

        bgmToggle.classList.toggle(
            "on",
            bgmEnabled
        );

    }


    if(bgmRange){

        bgmRange.value =
            bgmVolume;

    }


    if(bgmValue){

        bgmValue.textContent =
            bgmVolume + "%";

    }


    if(seToggle){

        seToggle.textContent =
            seEnabled ? "ON" : "OFF";

        seToggle.classList.toggle(
            "on",
            seEnabled
        );

    }


    if(voiceToggle){

        voiceToggle.textContent =
            voiceEnabled ? "ON" : "OFF";

        voiceToggle.classList.toggle(
            "on",
            voiceEnabled
        );

    }

}


applyBGMSettings();
updateBGMControls();


/* ==================================================
   初期処理
================================================== */

updateProfile();

updateCurrentTime();
