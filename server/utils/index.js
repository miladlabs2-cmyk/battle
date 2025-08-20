function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomName() {
    const animals = ['Falcon', 'Tiger', 'Wolf', 'Viper', 'Panther', 'Eagle', 'Shark', 'Dragon'];
    const colors = ['Crimson', 'Azure', 'Emerald', 'Amber', 'Ivory', 'Onyx', 'Cobalt', 'Scarlet'];
    return `${colors[getRandomInt(0, colors.length - 1)]}${animals[getRandomInt(0, animals.length - 1)]}-${getRandomInt(100, 999)}`;
}

module.exports = {
    getRandomInt,
    generateRandomName,
};


