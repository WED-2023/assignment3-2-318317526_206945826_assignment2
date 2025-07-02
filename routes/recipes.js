var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");

router.get("/", (req, res) => res.send("im here"));

router.get("/random", async (req, res, next) => {
  try {
    console.log("Req ssession = ", req.session);
    const randomRecipes = await recipes_utils.getRandomRecipes(3);
    res.status(200).send(randomRecipes);
  } catch (error) {
    next(error);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const {
      query,
      cuisine,
      diet,
      intolerances,
      number = 5,
      sortBy
    } = req.query;

    if (!query) {
      return res.status(400).send({ message: "Missing search query" });
    }

    const filters = { cuisine, diet, intolerances, sortBy };
    
    const user_id = req.user_id;
    console.log("in Recipes user_id = ", user_id);



    const results = await recipes_utils.searchRecipes(user_id, query, filters, number);

    if (!results.length) {
      return res.status(404).send({ message: "No recipes found" });
    }

    res.status(200).send(results);
  } catch (error) {
    next(error);
  }
});


/**
 * This path returns a full details of a recipe by its id
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getAllRecipeDetails(req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});





module.exports = router;
