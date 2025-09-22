const {Client, Events, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionsBitField

} = require('discord.js');
const {token} = require('./config.json');
const { DateTime } = require('luxon');


const client = new Client({intents: ['GuildMessages', 'MessageContent'] });
const userData = new Map(); //Data structure for memory storage
const path = require('path');
const XP_FILE = path.join(__dirname, 'xp.json');
const fs = require('fs');

//XP HELPER
const BASE_XP = 200;

function xpForNextLevel(L) {
 return BASE_XP * Math.pow(L + 1, 2);
}

let xpData = {};
if (fs.existsSync(XP_FILE)) {
  xpData = JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
}

function saveXP() {
  fs.writeFileSync(XP_FILE, JSON.stringify(xpData, null, 2));
}

//Get total xp, returns level and progress
function getLevelInfo(xp) {
  let L = 0, used = 0;
  // subtract cost of each level until xp < next cost
  while (xp >= used + xpForNextLevel(L)) {
    used += xpForNextLevel(L);
    L++;
  }
  const progress = xp - used;
  const toNext   = xpForNextLevel(L) - progress;
  return { level: L, progress, toNext };
}

//Accesses user xp history (To help with xp add and remove).
function getUserRecord(userId) {
  if (!xpData[userId]) xpData[userId] = { xp: 0 };
  return xpData[userId];
}
//XP HELPER ENDED


client.once(Events.ClientReady, c => {
    //Keeps login info
    console.log(`Logged in as ${c.user.username}`); 

    //The /daily command
    const ping = new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Complete your daily! (Based on UTC time)");
    
    //Green command
    const green = new SlashCommandBuilder()
      .setName("gsky")
      .setDescription("In rememberance.");

    //Trivia command
    const trivia = new SlashCommandBuilder()
      .setName("trivia")
      .setDescription("Test your knowledge!");


    //Xp main command
    const xpCmd = new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage user XP')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add XP to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('XP to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove XP from a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('XP to remove').setRequired(true))
    );



    //Actually creates the command in Discord
    client.application.commands.create(ping);
    client.application.commands.create(green);
    client.application.commands.create(trivia);
    client.application.commands.create(xpCmd);

});
/*TODO: 
GSKY COMMAND - 06/30/25 DONE
  1.) output randomized messages from a set pool (can do this just need to actually do it LOL)
  2.) implement NeetCity's own leveling system so I can set my own strike numbers (might have to do last, Like how arcane bot does it),  Implement Exp add/remove command as well.
  3.) implement a choose your own adventure game 
  4.) random trivia - 06/21/25 DONE
  5.) economy   
  6.) gambling
*/
const triviaMap = new Map ([["What's the capital of France?", "Paris"],
  ["What continent is the country Vatican City from?" , "Europe"], ["In China, what is the college entrance exam called?", "Gaokao"],
  ["In NeetCity, what person hates newgens the most?", "Flumie"], ["What day did Hasan Piker admit that he watches Trump yaoi? (Answer in the form of month day-th)", "June 5th"],
  ["What day did Green reveal his military service? (Answer in the form of month day-th)", "June 16th"], ["What is Lumie's most popular video?", "Femboy Roulette"],
  ["According to Lumie, when will Diddy try to enter your room? (Answer in the form of month day-th)", "December 7th"], 
  ["What is Mr. Manager's ethnicity?", " "]]
 );

//Recursive function for the bot to ask trivia question.
async function askTrivia(interaction, currentStreak, usedQuestions) {
  //DEBUG
 
  let channel = interaction.channel;
  if (!channel) {
    try {
      channel = await client.channels.fetch(interaction.channelId);
    } catch (err) {
      console.error("Failed to fetch the channel:", err);
    }
  }

  if (!channel) {
    // If we still don't have a channel, DM the user instead.
    try {
      channel = await interaction.user.createDM();
    } catch (err) {
      return interaction.followUp("Unable to find a channel to collect responses, and DM failed.");
    }
  }

  const available = Array
  .from(triviaMap.keys())
  .filter(q=>!usedQuestions.has(q));

  if (available.length === 0) {
    return channel.send(
      `🎉 You've answered every question! Final streak: **${currentStreak}**`
    );
  }

  const randomQuestion = available[Math.floor(Math.random() * available.length)];
  usedQuestions.add(randomQuestion);
  const correctAnswer = triviaMap.get(randomQuestion).trim().toLowerCase();


  await interaction.followUp({
    content: `**Trivia:** ${randomQuestion}\nType your answer or \`quit\` to exit.`,
});
   try {
    const collected = await interaction.channel.awaitMessages({
      filter: m => m.author.id === interaction.user.id,
      max: 1,
      time: 15000, // User has 15 seconds to answer
      errors: ['time']
    });
    console.log("message recieved.");
    const response = collected.first().content.trim().toLowerCase();

    if (response === 'quit') {
      return interaction.channel.send(`You quit! Final streak: **${currentStreak}**.`);
    }

    if (response === correctAnswer) {
      currentStreak++;
      await interaction.channel.send(`✅ Correct! Answer Streak: **${currentStreak}**`);
      askTrivia(interaction, currentStreak,usedQuestions); // Ask another question
    } else {
      await interaction.channel.send(`❌ Incorrect! The correct answer was **${correctAnswer}**. Final streak: **${currentStreak}**.`);
    }
  } catch (e) {
    await interaction.channel.send("⏳ Time's up! You didn't answer in time.");
  }

}

client.on(Events.InteractionCreate, async interaction => {
  if(interaction.commandName === 'trivia'){
    await interaction.reply("Starting trivia...");
    const used = new Set();
    askTrivia(interaction, 0, used);
    //return interaction.reply("TESTING. OUTPUT RECIEVED.");
  }
  else if(interaction.commandName === 'green'){
    const filePath = path.join(__dirname, 'the1.jpg')
    const greenImage = new AttachmentBuilder(filePath, {
      name:'the1.jpg'
    });
    const greenEmbeded = new EmbedBuilder()
      .setTitle("Good Luck. Peace and Love.")
      .setDescription("It's almost like he's here 😭")
      .setImage('attachment://the1');
    return interaction.reply({ embeds: [greenEmbeded], files: [greenImage] });
  }
  else if (interaction.commandName === 'xp') {
    // Ensure they have the Manage Roles permission
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({
        content: "❌ You don't have permission to change XP.",
        ephemeral: true
      });
    } else {
      const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const record = getUserRecord(target.id);

    // Add or remove
    if (sub === 'add') record.xp += amount;
    else record.xp = Math.max(0, record.xp - amount);

    saveXP();  

    const { level, progress, toNext } = getLevelInfo(record.xp);
    return interaction.reply(
      `${sub === 'add' ? 'Added' : 'Removed'} **${amount} XP** to ${target}.` +
      `\nNew level: **${level}** ( ${progress} / ${toNext} XP )`
    );
  }
}
  else if (interaction.commandName === 'daily') {
    // Use UTC time for check-ins
    const now = DateTime.utc();
    const today = now.toISODate(); // "YYYY-MM-DD" format
      let data = userData.get(interaction.user.id) || { streak: 0, lastCheckIn: null };

    // Check if the user has already checked in today
    if (data.lastCheckIn === today) {
      return interaction.reply("You’ve already checked in today!");
    }
    
    if (data.lastCheckIn) {
      const lastCheck = DateTime.fromISO(data.lastCheckIn, { zone: 'utc' });
      // Calculate the difference in days between now and the last check-in
      const diffDays = Math.floor(now.diff(lastCheck, 'days').days);
      
      if (diffDays === 1) {
          // Consecutive day check-in; increment streak
        data.streak++;
      } else {
        // Missed one or more days; reset streak to 1
        data.streak = 1;
      }
    } else {
      // First time check-in
      data.streak = 1;
    }
    
    data.lastCheckIn = today;
    userData.set(interaction.user.id, data);
    
    await interaction.reply(`Daily check-in successful! Your current streak is ${data.streak}.`);
  }
});

client.login(token);